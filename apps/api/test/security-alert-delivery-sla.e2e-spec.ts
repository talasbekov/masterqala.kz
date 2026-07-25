import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SecurityAlertDeliveryService } from '../src/admin/security-alert-delivery.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, loginAs, resetDb } from './helpers';

type AlertRow = {
  id: string;
  severity: string;
  status: string;
  assignedToUserId: string | null;
  acknowledgeBy: Date;
  resolveBy: Date;
  escalationLevel: number;
};

describe('Security alert delivery and SLA (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let delivery: SecurityAlertDeliveryService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    delivery = app.get(SecurityAlertDeliveryService);
  });

  beforeEach(async () => resetDb(app));
  afterAll(async () => app.close());

  async function createCriticalAlert(resourceId = 'upload-1') {
    await prisma.$executeRaw`
      INSERT INTO "SecurityAuditEvent" (
        "action", "severity", "outcome", "resourceType", "resourceId"
      ) VALUES (
        'FILE_SCAN_INFECTED', 'CRITICAL', 'REJECTED', 'PENDING_UPLOAD', ${resourceId}
      )
    `;
    const rows = await prisma.$queryRaw<AlertRow[]>`
      SELECT "id", "severity", "status", "assignedToUserId", "acknowledgeBy", "resolveBy", "escalationLevel"
      FROM "SecurityAlert"
      WHERE "resourceId" = ${resourceId}
      LIMIT 1
    `;
    return rows[0];
  }

  it('задаёт SLA, создаёт initial delivery и поддерживает assignment/escalation workflow', async () => {
    const client = await loginAs(app, '+77075551001');
    const operator = await loginAs(app, '+77000000001', 'OPERATOR');
    const alert = await createCriticalAlert();

    expect(alert.acknowledgeBy.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(alert.resolveBy.getTime() - Date.now()).toBeLessThanOrEqual(120 * 60 * 1000);

    const initial = await prisma.$queryRaw<Array<{ reason: string; status: string }>>`
      SELECT "reason", "status" FROM "SecurityAlertDelivery" WHERE "alertId" = ${alert.id}
    `;
    expect(initial).toEqual([expect.objectContaining({ reason: 'INITIAL', status: 'PENDING' })]);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/security/alerts/${alert.id}/assignment`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ assigneeUserId: operator.userId })
      .expect(403);

    const assigned = await request(app.getHttpServer())
      .patch(`/api/v1/admin/security/alerts/${alert.id}/assignment`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ assigneeUserId: operator.userId })
      .expect(200);
    expect(assigned.body.assignedToUserId).toBe(operator.userId);

    await prisma.$executeRaw`
      UPDATE "SecurityAlert" SET "acknowledgeBy" = CURRENT_TIMESTAMP - INTERVAL '1 minute'
      WHERE "id" = ${alert.id}
    `;
    await delivery.escalateOverdue();

    const escalated = await prisma.$queryRaw<AlertRow[]>`
      SELECT "id", "severity", "status", "assignedToUserId", "acknowledgeBy", "resolveBy", "escalationLevel"
      FROM "SecurityAlert" WHERE "id" = ${alert.id}
    `;
    expect(escalated[0].escalationLevel).toBe(1);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/security/alerts/${alert.id}`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ status: 'ACKNOWLEDGED', note: 'Принято в работу' })
      .expect(200);

    await prisma.$executeRaw`
      UPDATE "SecurityAlert" SET "resolveBy" = CURRENT_TIMESTAMP - INTERVAL '1 minute'
      WHERE "id" = ${alert.id}
    `;
    await delivery.escalateOverdue();

    const afterResolutionBreach = await prisma.$queryRaw<Array<{ escalationLevel: number }>>`
      SELECT "escalationLevel" FROM "SecurityAlert" WHERE "id" = ${alert.id}
    `;
    expect(afterResolutionBreach[0].escalationLevel).toBe(2);

    const deliveries = await request(app.getHttpServer())
      .get(`/api/v1/admin/security/alerts/${alert.id}/deliveries`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(deliveries.body.map((row: { reason: string }) => row.reason)).toEqual(
      expect.arrayContaining(['INITIAL', 'ACK_SLA_BREACH', 'RESOLUTION_SLA_BREACH']),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/security/alerts/${alert.id}/deliveries/retry`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(409);

    const audit = await prisma.$queryRaw<Array<{ action: string }>>`
      SELECT "action" FROM "SecurityAuditEvent"
      WHERE "resourceType" = 'SECURITY_ALERT' AND "resourceId" = ${alert.id}
    `;
    expect(audit.map((row) => row.action)).toEqual(expect.arrayContaining([
      'SECURITY_ALERT_ASSIGNED',
      'SECURITY_ALERT_SLA_BREACH',
      'SECURITY_ALERT_ACKNOWLEDGED',
    ]));
  });

  it('создаёт отдельную delivery при повышении severity до CRITICAL', async () => {
    await prisma.$executeRaw`
      INSERT INTO "SecurityAuditEvent" (
        "action", "severity", "outcome", "resourceType", "resourceId"
      ) VALUES (
        'FILE_SCAN_FAILED', 'HIGH', 'ERROR', 'MASTER_DOCUMENT', 'doc-1'
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO "SecurityAuditEvent" (
        "action", "severity", "outcome", "resourceType", "resourceId"
      ) VALUES (
        'FILE_SCAN_FAILED', 'CRITICAL', 'ERROR', 'MASTER_DOCUMENT', 'doc-1'
      )
    `;

    const alerts = await prisma.$queryRaw<Array<{ id: string; severity: string; occurrenceCount: number }>>`
      SELECT "id", "severity", "occurrenceCount" FROM "SecurityAlert"
      WHERE "resourceType" = 'MASTER_DOCUMENT' AND "resourceId" = 'doc-1'
    `;
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: 'CRITICAL', occurrenceCount: 2 });

    const rows = await prisma.$queryRaw<Array<{ reason: string }>>`
      SELECT "reason" FROM "SecurityAlertDelivery" WHERE "alertId" = ${alerts[0].id}
      ORDER BY "createdAt" ASC
    `;
    expect(rows.map((row) => row.reason)).toEqual(['INITIAL', 'SEVERITY_UPGRADE']);
  });
});
