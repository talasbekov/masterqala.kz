import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createPlannedOrderViaApi,
  createTestApp,
  loginAs,
  resetDb,
  seedCategories,
  uploadPngViaApi,
} from './helpers';

describe('upload quarantine (e2e)', () => {
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

  it('в test режиме синхронно возвращает CLEAN и скрывает status от другого пользователя', async () => {
    const owner = await loginAs(app, '+77000000101');
    const other = await loginAs(app, '+77000000102');
    const path = await uploadPngViaApi(app, owner.token);

    const ownerStatus = await request(app.getHttpServer())
      .get(`/api/v1/uploads/${encodeURIComponent(path)}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);

    expect(ownerStatus.body.scanStatus).toBe('CLEAN');
    expect(ownerStatus.body.path).toBe(path);

    await request(app.getHttpServer())
      .get(`/api/v1/uploads/${encodeURIComponent(path)}/status`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(404);
  });

  it.each(['PENDING_SCAN', 'SCANNING', 'INFECTED', 'SCAN_FAILED']) (
    'не позволяет привязать upload со статусом %s',
    async (scanStatus) => {
      const { plumbing } = await seedCategories(app);
      const owner = await loginAs(app, '+77000000103');
      const path = await uploadPngViaApi(app, owner.token);
      await prisma.$executeRawUnsafe(
        'UPDATE "PendingUpload" SET "scanStatus" = $1 WHERE "path" = $2',
        scanStatus,
        path,
      );

      const slotStart = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const slotEnd = new Date(Date.now() + 26 * 3600 * 1000).toISOString();
      const response = await request(app.getHttpServer())
        .post('/api/v1/planned-orders')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          categoryId: plumbing.id,
          description: 'Проверить кран',
          address: 'ул. Абая, 1',
          district: 'Алмалинский',
          slotStart,
          slotEnd,
          photoPaths: [path],
        })
        .expect(400);

      expect(response.body.message).toContain('не прошло проверку');
    },
  );

  it('DB-trigger не позволяет обойти CLEAN guard прямой вставкой фотографии', async () => {
    const { plumbing } = await seedCategories(app);
    const owner = await loginAs(app, '+77000000104');
    const path = await uploadPngViaApi(app, owner.token);
    const order = await createPlannedOrderViaApi(app, owner.token, plumbing.id);

    await prisma.$executeRawUnsafe(
      'UPDATE "PendingUpload" SET "scanStatus" = $1 WHERE "path" = $2',
      'PENDING_SCAN',
      path,
    );

    await expect(
      prisma.plannedOrderPhoto.create({
        data: { plannedOrderId: order.id, path },
      }),
    ).rejects.toThrow();

    const upload = await prisma.$queryRaw<Array<{ consumedAt: Date | null }>>`
      SELECT "consumedAt" FROM "PendingUpload" WHERE "path" = ${path}
    `;
    expect(upload[0].consumedAt).toBeNull();
  });
});
