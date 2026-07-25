import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HealthService } from '../health.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SecurityAlertQueryDto,
  SecurityAlertStatus,
  SecurityAlertTransitionDto,
} from './security-observability.dto';

type AlertRow = {
  id: string;
  ruleKey: string;
  severity: 'WARNING' | 'HIGH' | 'CRITICAL';
  title: string;
  resourceType: string;
  resourceId: string;
  sourceEventId: string | null;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedByUserId: string | null;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  operatorNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DashboardMetricsRow = {
  events24h: bigint;
  infected24h: bigint;
  scanFailed24h: bigint;
  openAlerts: bigint;
  acknowledgedAlerts: bigint;
  criticalAlerts: bigint;
  highAlerts: bigint;
  warningAlerts: bigint;
  oldestOpenAlertAt: Date | null;
};

type RecentEventRow = {
  id: string;
  action: string;
  severity: string;
  outcome: string;
  resourceType: string;
  resourceId: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

@Injectable()
export class SecurityObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly health: HealthService,
  ) {}

  async dashboard() {
    const [readiness, metricRows, alerts, recentEvents] = await Promise.all([
      this.health.readiness(true),
      this.prisma.$queryRaw<DashboardMetricsRow[]>`
        SELECT
          (SELECT COUNT(*) FROM "SecurityAuditEvent" WHERE "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '24 hours') AS "events24h",
          (SELECT COUNT(*) FROM "SecurityAuditEvent" WHERE "action" = 'FILE_SCAN_INFECTED' AND "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '24 hours') AS "infected24h",
          (SELECT COUNT(*) FROM "SecurityAuditEvent" WHERE "action" = 'FILE_SCAN_FAILED' AND "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '24 hours') AS "scanFailed24h",
          (SELECT COUNT(*) FROM "SecurityAlert" WHERE "status" = 'OPEN') AS "openAlerts",
          (SELECT COUNT(*) FROM "SecurityAlert" WHERE "status" = 'ACKNOWLEDGED') AS "acknowledgedAlerts",
          (SELECT COUNT(*) FROM "SecurityAlert" WHERE "status" != 'RESOLVED' AND "severity" = 'CRITICAL') AS "criticalAlerts",
          (SELECT COUNT(*) FROM "SecurityAlert" WHERE "status" != 'RESOLVED' AND "severity" = 'HIGH') AS "highAlerts",
          (SELECT COUNT(*) FROM "SecurityAlert" WHERE "status" != 'RESOLVED' AND "severity" = 'WARNING') AS "warningAlerts",
          (SELECT MIN("firstSeenAt") FROM "SecurityAlert" WHERE "status" = 'OPEN') AS "oldestOpenAlertAt"
      `,
      this.list({ status: SecurityAlertStatus.OPEN, limit: 10 }),
      this.prisma.$queryRaw<RecentEventRow[]>`
        SELECT "id", "action", "severity", "outcome", "resourceType", "resourceId",
               "actorUserId", "metadata", "createdAt"
        FROM "SecurityAuditEvent"
        ORDER BY "createdAt" DESC, "id" DESC
        LIMIT 15
      `,
    ]);
    const metrics = metricRows[0];

    return {
      generatedAt: new Date().toISOString(),
      readiness,
      metrics: {
        events24h: Number(metrics?.events24h ?? 0),
        infected24h: Number(metrics?.infected24h ?? 0),
        scanFailed24h: Number(metrics?.scanFailed24h ?? 0),
        openAlerts: Number(metrics?.openAlerts ?? 0),
        acknowledgedAlerts: Number(metrics?.acknowledgedAlerts ?? 0),
        criticalAlerts: Number(metrics?.criticalAlerts ?? 0),
        highAlerts: Number(metrics?.highAlerts ?? 0),
        warningAlerts: Number(metrics?.warningAlerts ?? 0),
        oldestOpenAlertAt: metrics?.oldestOpenAlertAt ?? null,
      },
      alerts: alerts.items,
      recentEvents,
    };
  }

  async list(query: SecurityAlertQueryDto) {
    const status = query.status ?? null;
    const severity = query.severity ?? null;
    const ruleKey = query.ruleKey ?? null;
    const before = query.before ? new Date(query.before) : null;
    const beforeId = query.beforeId ?? null;
    const limit = query.limit ?? 50;

    const rows = await this.prisma.$queryRaw<AlertRow[]>`
      SELECT
        "id", "ruleKey", "severity", "title", "resourceType", "resourceId",
        "sourceEventId", "status", "occurrenceCount", "firstSeenAt", "lastSeenAt",
        "acknowledgedAt", "acknowledgedByUserId", "resolvedAt", "resolvedByUserId",
        "operatorNote", "createdAt", "updatedAt"
      FROM "SecurityAlert"
      WHERE (${status}::text IS NULL OR "status" = ${status})
        AND (${severity}::text IS NULL OR "severity" = ${severity})
        AND (${ruleKey}::text IS NULL OR "ruleKey" = ${ruleKey})
        AND (
          ${before}::timestamp IS NULL
          OR "lastSeenAt" < ${before}
          OR (
            "lastSeenAt" = ${before}
            AND (${beforeId}::text IS NULL OR "id" < ${beforeId})
          )
        )
      ORDER BY
        CASE "severity" WHEN 'CRITICAL' THEN 3 WHEN 'HIGH' THEN 2 ELSE 1 END DESC,
        "lastSeenAt" DESC,
        "id" DESC
      LIMIT ${limit}
    `;
    const last = rows.at(-1);

    return {
      items: rows,
      nextCursor: rows.length === limit && last
        ? { before: last.lastSeenAt.toISOString(), beforeId: last.id }
        : null,
    };
  }

  async transition(operatorId: string, alertId: string, dto: SecurityAlertTransitionDto) {
    if (dto.status === SecurityAlertStatus.OPEN) {
      throw new BadRequestException('Возврат alert в OPEN не поддерживается');
    }

    const note = dto.note?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      const rows = dto.status === SecurityAlertStatus.ACKNOWLEDGED
        ? await tx.$queryRaw<AlertRow[]>`
            UPDATE "SecurityAlert"
            SET "status" = 'ACKNOWLEDGED',
                "acknowledgedAt" = CURRENT_TIMESTAMP,
                "acknowledgedByUserId" = ${operatorId},
                "operatorNote" = COALESCE(${note}, "operatorNote"),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${alertId} AND "status" = 'OPEN'
            RETURNING *
          `
        : await tx.$queryRaw<AlertRow[]>`
            UPDATE "SecurityAlert"
            SET "status" = 'RESOLVED',
                "resolvedAt" = CURRENT_TIMESTAMP,
                "resolvedByUserId" = ${operatorId},
                "operatorNote" = COALESCE(${note}, "operatorNote"),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${alertId} AND "status" IN ('OPEN', 'ACKNOWLEDGED')
            RETURNING *
          `;

      const changed = rows[0];
      if (!changed) {
        const existingRows = await tx.$queryRaw<AlertRow[]>`
          SELECT * FROM "SecurityAlert" WHERE "id" = ${alertId} LIMIT 1
        `;
        const existing = existingRows[0];
        if (!existing) throw new NotFoundException('Security alert не найден');
        if (existing.status === dto.status) return existing;
        if (existing.status === SecurityAlertStatus.RESOLVED) {
          throw new ConflictException('Security alert уже закрыт');
        }
        throw new ConflictException('Недопустимый переход состояния security alert');
      }

      await tx.$executeRaw`
        INSERT INTO "SecurityAuditEvent" (
          "action", "severity", "outcome", "resourceType", "resourceId", "actorUserId", "metadata"
        ) VALUES (
          ${dto.status === SecurityAlertStatus.ACKNOWLEDGED ? 'SECURITY_ALERT_ACKNOWLEDGED' : 'SECURITY_ALERT_RESOLVED'},
          'INFO',
          'SUCCESS',
          'SECURITY_ALERT',
          ${alertId},
          ${operatorId},
          jsonb_strip_nulls(jsonb_build_object('ruleKey', ${changed.ruleKey}, 'note', ${note}))
        )
      `;

      return changed;
    });
  }
}
