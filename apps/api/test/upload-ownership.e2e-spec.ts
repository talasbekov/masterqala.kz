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

describe('Upload ownership and TTL (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  let clientA: { token: string; userId: string };
  let clientB: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(app);
    categoryId = (await seedCategories(app)).plumbing.id;
    clientA = await loginAs(app, '+77071110001');
    clientB = await loginAs(app, '+77071110002');
  });

  afterAll(async () => {
    await app.close();
  });

  function plannedPayload(photoPath: string) {
    const slotStart = new Date(Date.now() + 24 * 3600 * 1000);
    return {
      categoryId,
      description: 'Установить смеситель',
      address: 'ул. Абая, 1',
      district: 'Алмалинский',
      slotStart: slotStart.toISOString(),
      slotEnd: new Date(slotStart.getTime() + 2 * 3600 * 1000).toISOString(),
      photoPaths: [photoPath],
    };
  }

  it('регистрирует upload за текущим пользователем и с будущим TTL', async () => {
    const path = await uploadPngViaApi(app, clientA.token);

    const upload = await prisma.pendingUpload.findUniqueOrThrow({ where: { path } });
    expect(upload.userId).toBe(clientA.userId);
    expect(upload.mimeType).toBe('image/png');
    expect(upload.sizeBytes).toBeGreaterThan(0);
    expect(upload.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(upload.consumedAt).toBeNull();
  });

  it('атомарно потребляет upload владельца при создании плановой заявки', async () => {
    const path = await uploadPngViaApi(app, clientA.token);

    const order = await createPlannedOrderViaApi(app, clientA.token, categoryId, {
      photoPaths: [path],
    });

    const [upload, photo] = await Promise.all([
      prisma.pendingUpload.findUniqueOrThrow({ where: { path } }),
      prisma.plannedOrderPhoto.findFirstOrThrow({ where: { plannedOrderId: order.id, path } }),
    ]);
    expect(upload.consumedAt).toBeInstanceOf(Date);
    expect(photo.path).toBe(path);
  });

  it('не позволяет другому пользователю привязать чужой upload', async () => {
    const path = await uploadPngViaApi(app, clientA.token);

    await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${clientB.token}`)
      .send(plannedPayload(path))
      .expect(400);

    const upload = await prisma.pendingUpload.findUniqueOrThrow({ where: { path } });
    expect(upload.userId).toBe(clientA.userId);
    expect(upload.consumedAt).toBeNull();
    expect(await prisma.plannedOrderPhoto.count({ where: { path } })).toBe(0);
  });

  it('не позволяет повторно использовать уже потреблённый upload', async () => {
    const path = await uploadPngViaApi(app, clientA.token);
    await createPlannedOrderViaApi(app, clientA.token, categoryId, { photoPaths: [path] });

    const response = await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${clientA.token}`)
      .send(plannedPayload(path))
      .expect(400);

    expect(response.body.message).toBe('Фото недоступно, не прошло проверку, истекло или уже использовано');
    expect(await prisma.plannedOrderPhoto.count({ where: { path } })).toBe(1);
  });

  it('не позволяет использовать upload после истечения TTL', async () => {
    const path = await uploadPngViaApi(app, clientA.token);
    await prisma.pendingUpload.update({
      where: { path },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${clientA.token}`)
      .send(plannedPayload(path))
      .expect(400);

    expect(response.body.message).toBe('Фото недоступно, не прошло проверку, истекло или уже использовано');
    expect(await prisma.plannedOrderPhoto.count({ where: { path } })).toBe(0);
  });

  it('DB-trigger закрывает гонку и не позволяет повторную вставку в обход API guard', async () => {
    const path = await uploadPngViaApi(app, clientA.token);
    const first = await createPlannedOrderViaApi(app, clientA.token, categoryId, { photoPaths: [path] });

    const second = await prisma.plannedOrder.create({
      data: {
        clientId: clientA.userId,
        categoryId,
        description: 'Вторая заявка',
        address: 'ул. Абая, 2',
        district: 'Алмалинский',
        slotStart: new Date(Date.now() + 48 * 3600 * 1000),
        slotEnd: new Date(Date.now() + 50 * 3600 * 1000),
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    await expect(
      prisma.plannedOrderPhoto.create({ data: { plannedOrderId: second.id, path } }),
    ).rejects.toThrow();

    expect(await prisma.plannedOrderPhoto.count({ where: { path } })).toBe(1);
    expect(await prisma.plannedOrderPhoto.count({ where: { plannedOrderId: first.id } })).toBe(1);
  });
});
