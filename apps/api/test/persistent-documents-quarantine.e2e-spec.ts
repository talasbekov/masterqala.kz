import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, loginAs, resetDb, seedCategories, TEST_PNG_BYTES } from './helpers';

describe('Persistent document quarantine (e2e)', () => {
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

  async function createMasterApplication(token: string, categoryId: string) {
    return request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Иванов Иван Иванович',
        iin: '900101300123',
        district: 'Бостандыкский',
        experienceYears: 5,
        categoryIds: [categoryId],
      })
      .expect(201);
  }

  it('сканирует документ мастера, ограничивает status владельцем и блокирует pending download', async () => {
    const { plumbing } = await seedCategories(app);
    const owner = await loginAs(app, '+77071112221');
    const stranger = await loginAs(app, '+77071112222');
    const operator = await loginAs(app, '+77000000001', 'OPERATOR');
    const application = await createMasterApplication(owner.token, plumbing.id);

    const upload = await request(app.getHttpServer())
      .post('/api/v1/masters/application/documents')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('type', 'ID_CARD')
      .attach('file', TEST_PNG_BYTES, { filename: 'identity.png', contentType: 'image/png' })
      .expect(201);

    expect(upload.body.scanStatus).toBe('CLEAN');
    expect(upload.body.cdrStatus).toBe('NOT_REQUIRED');
    expect(upload.body.statusPath).toBe(`/masters/application/documents/${upload.body.id}/status`);

    const rows = await prisma.$queryRaw<Array<{ scanStatus: string; cdrStatus: string }>>`
      SELECT "scanStatus", "cdrStatus"
      FROM "MasterDocument"
      WHERE "id" = ${upload.body.id}
    `;
    expect(rows[0]).toEqual({ scanStatus: 'CLEAN', cdrStatus: 'NOT_REQUIRED' });

    await request(app.getHttpServer())
      .get(upload.body.statusPath)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(upload.body.statusPath)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(404);

    await prisma.$executeRaw`
      UPDATE "MasterDocument" SET "scanStatus" = 'PENDING_SCAN' WHERE "id" = ${upload.body.id}
    `;
    await request(app.getHttpServer())
      .get(`/api/v1/admin/applications/${application.body.id}/documents/${upload.body.id}`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(404);
  });

  it('публикует evidence только после CLEAN и разрешает status только участникам спора', async () => {
    const { plumbing } = await seedCategories(app);
    const client = await loginAs(app, '+77071113331');
    const master = await loginAs(app, '+77071113332');
    const stranger = await loginAs(app, '+77071113333');

    const order = await prisma.order.create({
      data: {
        clientId: client.userId,
        masterId: master.userId,
        categoryId: plumbing.id,
        description: 'Проверить протечку',
        address: 'ул. Абая, 1',
        district: 'Алмалинский',
        status: 'IN_PROGRESS',
        calloutPrice: 0,
        serviceFee: 0,
      },
    });
    const dispute = await prisma.dispute.create({
      data: {
        orderId: order.id,
        openedByUserId: client.userId,
        openedByRole: 'CLIENT',
        reason: 'Повреждение имущества',
      },
    });

    const upload = await request(app.getHttpServer())
      .post(`/api/v1/disputes/${dispute.id}/evidence`)
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', TEST_PNG_BYTES, { filename: 'evidence.png', contentType: 'image/png' })
      .expect(201);

    expect(upload.body.scanStatus).toBe('CLEAN');
    expect(upload.body.statusPath).toBe(`/disputes/${dispute.id}/evidence/${upload.body.id}/status`);

    const evidenceRows = await prisma.$queryRaw<Array<{ scanStatus: string; path: string }>>`
      SELECT "scanStatus", "path" FROM "DisputeEvidence" WHERE "id" = ${upload.body.id}
    `;
    expect(evidenceRows[0].scanStatus).toBe('CLEAN');

    const updatedDispute = await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } });
    expect(updatedDispute.evidenceDocIds).toContain(upload.body.path);

    await request(app.getHttpServer())
      .get(upload.body.statusPath)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(upload.body.statusPath)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);

    const pendingPath = `${randomUUID()}.png`;
    await prisma.$executeRaw`
      INSERT INTO "DisputeEvidence" (
        "id", "disputeId", "uploadedByUserId", "path", "mimeType", "sizeBytes"
      ) VALUES (
        ${randomUUID()}, ${dispute.id}, ${client.userId}, ${pendingPath}, 'image/png', 9
      )
    `;
    await request(app.getHttpServer())
      .get(`/api/v1/disputes/${dispute.id}/evidence/${pendingPath}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(404);
  });
});
