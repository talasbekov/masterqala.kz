import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JOBS } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';

export type SecurityDeliveryStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'EXHAUSTED';
export type SecurityDeliveryReason =
  | 'INITIAL'
  | 'SEVERITY_UPGRADE'
  | 'ACK_SLA_BREACH'
  | 'RESOLUTION_SLA_BREACH'
  | 'MANUAL_RETRY';

type DeliveryClaim = {
  id: string;
  alertId: string;
  reason: SecurityDeliveryReason;
  attemptCount: number;
};

type AlertPayloadRow = {
  id: string;
  ruleKey: string;
  severity: 'WARNING' | 'HIGH' | 'CRITICAL';
  title: string;
  resourceType: string;
  resourceId: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  acknowledgeBy: Date | null;
  resolveBy: Date | null;
  escalationLevel: number;
};

type EscalationCandidate = AlertPayloadRow & {
  targetLevel: number;
  deliveryReason: 'ACK_SLA_BREACH' | 'RESOLUTION_SLA_BREACH';
};

@Injectable()
export class SecurityAlertDeliveryService implements OnModuleInit {
  private readonly logger = new Logger(SecurityAlertDeliveryService.name);
  private readonly webhookUrl: string | null;
  private readonly webhookSecret: string | null;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
  ) {
    this.webhookUrl = this.config.get<string>('SECURITY_ALERT_WEBHOOK_URL') || null;
    this.webhookSecret = this.config.get<string>('SECURITY_ALERT_WEBHOOK_SECRET') || null;
    this.timeoutMs = this.config.get<number>('SECURITY_ALERT_WEBHOOK_TIMEOUT_MS') ?? 5000;
    this.maxAttempts = this.config.get<number>('SECURITY_ALERT_DELIVERY_MAX_ATTEMPTS') ?? 5;
  }

  onModuleInit(): void {
    this.queue.register(JOBS.SECURITY_ALERT_DELIVERY, (data: { deliveryId: string }) =>
      this.deliver(data.deliveryId),
    );
    this.queue.registerCron(JOBS.SECURITY_ALERT_DELIVERY_SWEEP, '* * * * *', () =>
      this.dispatchPending(),
    );
    this.queue.registerCron(JOBS.SECURITY_ALERT_SLA_SWEEP, '* * * * *', () =>
      this.escalateOverdue(),
    );
  }

  health() {
    return {
      enabled: Boolean(this.webhookUrl && this.webhookSecret),
      channel: 'WEBHOOK' as const,
      maxAttempts: this.maxAttempts,
      timeoutMs: this.timeoutMs,
    };
  }

  async dispatchPending(limit = 100): Promise<void> {
    if (!this.webhookUrl || !this.webhookSecret) return;

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "SecurityAlertDelivery"
      WHERE "status" IN ('PENDING', 'FAILED')
        AND "nextAttemptAt" <= CURRENT_TIMESTAMP
        AND "attemptCount" < ${this.maxAttempts}
      ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
      LIMIT ${limit}
    `;

    const queueDisabled = this.queue.healthCheck().status === 'DISABLED';
    for (const row of rows) {
      if (queueDisabled) await this.deliver(row.id);
      else await this.queue.send(JOBS.SECURITY_ALERT_DELIVERY, { deliveryId: row.id });
    }
  }

  async deliver(deliveryId: string): Promise<void> {
    if (!this.webhookUrl || !this.webhookSecret) return;

    const claimed = await this.prisma.$queryRaw<DeliveryClaim[]>`
      UPDATE "SecurityAlertDelivery"
      SET "status" = 'SENDING',
          "attemptCount" = "attemptCount" + 1,
          "lastAttemptAt" = CURRENT_TIMESTAMP,
          "error" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${deliveryId}
        AND "status" IN ('PENDING', 'FAILED')
        AND "nextAttemptAt" <= CURRENT_TIMESTAMP
        AND "attemptCount" < ${this.maxAttempts}
      RETURNING "id", "alertId", "reason", "attemptCount"
    `;
    const delivery = claimed[0];
    if (!delivery) return;

    const alerts = await this.prisma.$queryRaw<AlertPayloadRow[]>`
      SELECT "id", "ruleKey", "severity", "title", "resourceType", "resourceId",
             "status", "occurrenceCount", "firstSeenAt", "lastSeenAt",
             "acknowledgeBy", "resolveBy", "escalationLevel"
      FROM "SecurityAlert"
      WHERE "id" = ${delivery.alertId}
      LIMIT 1
    `;
    const alert = alerts[0];
    if (!alert) {
      await this.markFailure(delivery, 'Security alert no longer exists', null);
      return;
    }

    const body = JSON.stringify({
      event: 'security.alert',
      deliveryId: delivery.id,
      reason: delivery.reason,
      occurredAt: new Date().toISOString(),
      alert: {
        id: alert.id,
        ruleKey: alert.ruleKey,
        severity: alert.severity,
        title: alert.title,
        resourceType: alert.resourceType,
        resourceId: alert.resourceId,
        status: alert.status,
        occurrenceCount: alert.occurrenceCount,
        firstSeenAt: alert.firstSeenAt,
        lastSeenAt: alert.lastSeenAt,
        acknowledgeBy: alert.acknowledgeBy,
        resolveBy: alert.resolveBy,
        escalationLevel: alert.escalationLevel,
      },
    });
    const signature = createHmac('sha256', this.webhookSecret).update(body).digest('hex');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let responseCode: number | null = null;

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-masterqala-event': 'security.alert',
          'x-masterqala-delivery': delivery.id,
          'x-masterqala-signature': `sha256=${signature}`,
        },
        body,
        signal: controller.signal,
      });
      responseCode = response.status;
      if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);

      await this.prisma.$executeRaw`
        UPDATE "SecurityAlertDelivery"
        SET "status" = 'SENT',
            "deliveredAt" = CURRENT_TIMESTAMP,
            "responseCode" = ${response.status},
            "error" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${delivery.id} AND "status" = 'SENDING'
      `;
      await this.prisma.$executeRaw`
        UPDATE "SecurityAlert"
        SET "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${delivery.alertId}
      `;
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'Webhook request timed out'
        : (error as Error).message;
      await this.markFailure(delivery, message.slice(0, 500), responseCode);
    } finally {
      clearTimeout(timer);
    }
  }

  private async markFailure(delivery: DeliveryClaim, message: string, responseCode: number | null): Promise<void> {
    const exhausted = delivery.attemptCount >= this.maxAttempts;
    const delaySeconds = Math.min(3600, 60 * 2 ** Math.max(0, delivery.attemptCount - 1));
    const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "SecurityAlertDelivery"
        SET "status" = ${exhausted ? 'EXHAUSTED' : 'FAILED'},
            "nextAttemptAt" = ${nextAttemptAt},
            "responseCode" = ${responseCode},
            "error" = ${message},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${delivery.id} AND "status" = 'SENDING'
      `;

      if (exhausted) {
        await tx.$executeRaw`
          INSERT INTO "SecurityAuditEvent" (
            "action", "severity", "outcome", "resourceType", "resourceId", "metadata"
          ) VALUES (
            'SECURITY_ALERT_DELIVERY_EXHAUSTED', 'HIGH', 'ERROR', 'SECURITY_ALERT', ${delivery.alertId},
            jsonb_build_object('deliveryId', ${delivery.id}, 'attemptCount', ${delivery.attemptCount})
          )
        `;
      }
    });
    this.logger.warn(`Security alert delivery ${delivery.id} failed: ${message}`);
  }

  async escalateOverdue(limit = 100): Promise<void> {
    const candidates = await this.prisma.$queryRaw<EscalationCandidate[]>`
      SELECT "id", "ruleKey", "severity", "title", "resourceType", "resourceId",
             "status", "occurrenceCount", "firstSeenAt", "lastSeenAt",
             "acknowledgeBy", "resolveBy", "escalationLevel",
             CASE WHEN "status" = 'OPEN' THEN 1 ELSE 2 END AS "targetLevel",
             CASE WHEN "status" = 'OPEN' THEN 'ACK_SLA_BREACH' ELSE 'RESOLUTION_SLA_BREACH' END AS "deliveryReason"
      FROM "SecurityAlert"
      WHERE (
          "status" = 'OPEN'
          AND "acknowledgeBy" <= CURRENT_TIMESTAMP
          AND "escalationLevel" < 1
        ) OR (
          "status" = 'ACKNOWLEDGED'
          AND "resolveBy" <= CURRENT_TIMESTAMP
          AND "escalationLevel" < 2
        )
      ORDER BY COALESCE("acknowledgeBy", "resolveBy") ASC
      LIMIT ${limit}
    `;

    for (const candidate of candidates) await this.escalateOne(candidate);
    await this.dispatchPending(limit);
  }

  private async escalateOne(candidate: EscalationCandidate): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "SecurityAlert"
        SET "escalationLevel" = ${candidate.targetLevel},
            "escalatedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${candidate.id}
          AND "status" = ${candidate.status}
          AND "escalationLevel" < ${candidate.targetLevel}
        RETURNING "id"
      `;
      if (!changed[0]) return;

      await tx.$executeRaw`
        INSERT INTO "SecurityAuditEvent" (
          "action", "severity", "outcome", "resourceType", "resourceId", "metadata"
        ) VALUES (
          'SECURITY_ALERT_SLA_BREACH',
          ${candidate.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH'},
          'ERROR',
          'SECURITY_ALERT',
          ${candidate.id},
          jsonb_build_object(
            'ruleKey', ${candidate.ruleKey},
            'breach', ${candidate.deliveryReason},
            'escalationLevel', ${candidate.targetLevel}
          )
        )
      `;
      await tx.$executeRaw`
        INSERT INTO "SecurityAlertDelivery" (
          "alertId", "reason", "dedupeKey", "createdAt", "updatedAt"
        ) VALUES (
          ${candidate.id}, ${candidate.deliveryReason},
          ${`${candidate.id}:${candidate.deliveryReason}:${candidate.targetLevel}`},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT ("dedupeKey") DO NOTHING
      `;
    });
  }

  async listForAlert(alertId: string) {
    const alerts = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "SecurityAlert" WHERE "id" = ${alertId} LIMIT 1
    `;
    if (!alerts[0]) throw new NotFoundException('Security alert не найден');

    return this.prisma.$queryRaw`
      SELECT "id", "channel", "reason", "status", "attemptCount", "nextAttemptAt",
             "lastAttemptAt", "deliveredAt", "responseCode", "error", "createdAt"
      FROM "SecurityAlertDelivery"
      WHERE "alertId" = ${alertId}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `;
  }

  async manualRetry(operatorId: string, alertId: string) {
    if (!this.webhookUrl || !this.webhookSecret) {
      throw new ConflictException('Security alert webhook не настроен');
    }

    const deliveryId = randomUUID();
    const dedupeKey = `${alertId}:MANUAL_RETRY:${deliveryId}`;
    const result = await this.prisma.$transaction(async (tx) => {
      const alerts = await tx.$queryRaw<Array<{ id: string; ruleKey: string }>>`
        SELECT "id", "ruleKey" FROM "SecurityAlert" WHERE "id" = ${alertId} LIMIT 1
      `;
      const alert = alerts[0];
      if (!alert) throw new NotFoundException('Security alert не найден');

      const rows = await tx.$queryRaw`
        INSERT INTO "SecurityAlertDelivery" (
          "id", "alertId", "reason", "dedupeKey", "createdAt", "updatedAt"
        ) VALUES (
          ${deliveryId}, ${alertId}, 'MANUAL_RETRY', ${dedupeKey}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING "id", "alertId", "reason", "status", "attemptCount", "nextAttemptAt", "createdAt"
      `;
      await tx.$executeRaw`
        INSERT INTO "SecurityAuditEvent" (
          "action", "severity", "outcome", "resourceType", "resourceId", "actorUserId", "metadata"
        ) VALUES (
          'SECURITY_ALERT_DELIVERY_RETRIED', 'INFO', 'SUCCESS', 'SECURITY_ALERT', ${alertId}, ${operatorId},
          jsonb_build_object('deliveryId', ${deliveryId}, 'ruleKey', ${alert.ruleKey})
        )
      `;
      return rows;
    });

    if (this.queue.healthCheck().status === 'DISABLED') await this.deliver(deliveryId);
    else await this.queue.send(JOBS.SECURITY_ALERT_DELIVERY, { deliveryId });
    return result;
  }
}
