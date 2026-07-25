import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, loginAs, resetDb, TEST_PNG_BYTES } from './helpers';

type AuditRow = {
  id: string;
  action: string;
  severity: string;
  outcome: string;
  actorUserId: string | null;
};

describe('Security audit trail (e2e)', () => {
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

  it('атомарно пишет lifecycle upload и отдаёт его только оператору', async () => {
    const client = await loginAs(app, '+77072220001');
    const upload = await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', TEST_PNG_BYTES, { filename: 'audit.png', contentType: 'image/png' })
      .expect(201);

    const uploadRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "PendingUpload" WHERE "path" = ${upload.body.path}
    `;
    const uploadId = uploadRows[0].id;
    const events = await prisma.$queryRaw<AuditRow[]>`
      SELECT "id", "action", "severity", "outcome", "actorUserId"
      FROM "SecurityAuditEvent"
      WHERE "resourceType" = 'PENDING_UPLOAD' AND "resourceId" = ${uploadId}
    `;

    expect(events).toHaveLength(3);
    expect(events.map((event) => event.action)).toEqual(expect.arrayContaining([
      'FILE_REGISTERED',
      'FILE_SCAN_STARTED',
      'FILE_SCAN_CLEAN',
    ]));
    expect(events.every((event) => event.actorUserId === client.userId)).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/v1/admin/security/events?resourceId=${uploadId}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);

    const operator = await loginAs(app, '+77000000001', 'OPERATOR');
    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/security/events?resourceId=${uploadId}&action=FILE_SCAN_CLEAN&limit=10`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      action: 'FILE_SCAN_CLEAN',
      severity: 'INFO',
      outcome: 'SUCCESS',
      resourceType: 'PENDING_UPLOAD',
      resourceId: uploadId,
      actorUserId: client.userId,
    });
    expect(response.body.nextCursor).toBeNull();
  });

  it('не разрешает изменять audit event и валидирует фильтры', async () => {
    await prisma.$executeRaw`
      INSERT INTO "SecurityAuditEvent" (
        "action", "severity", "outcome", "resourceType", "resourceId"
      ) VALUES ('TEST_EVENT', 'INFO', 'SUCCESS', 'SYSTEM', 'test')
    `;
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "SecurityAuditEvent" WHERE "action" = 'TEST_EVENT'
    `;

    await expect(prisma.$executeRaw`
      UPDATE "SecurityAuditEvent" SET "action" = 'TAMPERED' WHERE "id" = ${rows[0].id}
    `).rejects.toThrow();

    const operator = await loginAs(app, '+77000000001', 'OPERATOR');
    await request(app.getHttpServer())
      .get('/api/v1/admin/security/events?limit=101')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/admin/security/events?severity=UNKNOWN')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(400);
  });
});
