import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, loginAs, resetDb } from './helpers';

describe('Security observability (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('дедуплицирует критические события и проводит alert через acknowledge/resolve', async () => {
    const client = await loginAs(app, '+77073330001');
    const resourceId = 'infected-file-1';

    for (let index = 0; index < 2; index += 1) {
      await prisma.$executeRaw`
        INSERT INTO "SecurityAuditEvent" (
          "action", "severity", "outcome", "resourceType", "resourceId", "actorUserId", "metadata"
        ) VALUES (
          'FILE_SCAN_INFECTED', 'CRITICAL', 'REJECTED', 'PENDING_UPLOAD', ${resourceId},
          ${client.userId}, jsonb_build_object('signature', 'Eicar-Test-Signature')
        )
      `;
    }

    const alertRows = await prisma.$queryRaw<Array<{
      id: string;
      status: string;
      severity: string;
      occurrenceCount: number;
    }>>`
      SELECT "id", "status", "severity", "occurrenceCount"
      FROM "SecurityAlert"
      WHERE "resourceId" = ${resourceId}
    `;
    expect(alertRows).toHaveLength(1);
    expect(alertRows[0]).toMatchObject({
      status: 'OPEN',
      severity: 'CRITICAL',
      occurrenceCount: 2,
    });

    await request(app.getHttpServer())
      .get('/api/v1/admin/security/dashboard')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);

    const operator = await loginAs(app, '+77000000001', 'OPERATOR');
    const dashboard = await request(app.getHttpServer())
      .get('/api/v1/admin/security/dashboard')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(dashboard.body.metrics).toMatchObject({
      infected24h: 2,
      openAlerts: 1,
      criticalAlerts: 1,
    });
    expect(dashboard.body.readiness.environment).toBe('test');
    expect(dashboard.body.readiness.backlog.openCriticalAlerts).toBe(1);
    expect(dashboard.body.alerts[0].id).toBe(alertRows[0].id);

    const acknowledged = await request(app.getHttpServer())
      .patch(`/api/v1/admin/security/alerts/${alertRows[0].id}`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ status: 'ACKNOWLEDGED', note: 'Инцидент принят в работу' })
      .expect(200);
    expect(acknowledged.body).toMatchObject({
      status: 'ACKNOWLEDGED',
      acknowledgedByUserId: operator.userId,
      operatorNote: 'Инцидент принят в работу',
    });

    const resolved = await request(app.getHttpServer())
      .patch(`/api/v1/admin/security/alerts/${alertRows[0].id}`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ status: 'RESOLVED', note: 'Файл удалён, источник проверен' })
      .expect(200);
    expect(resolved.body).toMatchObject({
      status: 'RESOLVED',
      resolvedByUserId: operator.userId,
      operatorNote: 'Файл удалён, источник проверен',
    });

    const actionRows = await prisma.$queryRaw<Array<{ action: string }>>`
      SELECT "action"
      FROM "SecurityAuditEvent"
      WHERE "resourceType" = 'SECURITY_ALERT' AND "resourceId" = ${alertRows[0].id}
      ORDER BY "createdAt" ASC
    `;
    expect(actionRows.map((row) => row.action).sort()).toEqual([
      'SECURITY_ALERT_ACKNOWLEDGED',
      'SECURITY_ALERT_RESOLVED',
    ]);
  });

  it('валидирует alert filters и запрещает возврат в OPEN', async () => {
    const operator = await loginAs(app, '+77000000001', 'OPERATOR');

    await request(app.getHttpServer())
      .get('/api/v1/admin/security/alerts?severity=UNKNOWN')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(400);

    await request(app.getHttpServer())
      .patch('/api/v1/admin/security/alerts/missing')
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ status: 'OPEN' })
      .expect(400);
  });
});
