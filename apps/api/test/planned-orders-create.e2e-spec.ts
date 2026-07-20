import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createPlannedOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Публикация плановой заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77060000001');
  });

  it('создание сразу публикует заявку', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    expect(order.status).toBe('PUBLISHED');
    expect(order.publishedAt).toBeTruthy();
    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.clientId).toBe(client.userId);
  });

  it('дата в прошлом — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'т',
        address: 'а',
        district: 'р',
        slotStart: new Date(Date.now() - 3600_000).toISOString(),
        slotEnd: new Date(Date.now() - 1800_000).toISOString(),
      })
      .expect(400);
  });

  it('дата дальше 14 дней — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'т',
        address: 'а',
        district: 'р',
        slotStart: new Date(Date.now() + 20 * 24 * 3600_000).toISOString(),
        slotEnd: new Date(Date.now() + 20 * 24 * 3600_000 + 3600_000).toISOString(),
      })
      .expect(400);
  });

  it('slotEnd раньше slotStart — 400', async () => {
    const start = new Date(Date.now() + 24 * 3600 * 1000);
    await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'т',
        address: 'а',
        district: 'р',
        slotStart: start.toISOString(),
        slotEnd: new Date(start.getTime() - 3600 * 1000).toISOString(),
      })
      .expect(400);
  });

  it('GET /planned-orders/mine возвращает заявки клиента', async () => {
    await createPlannedOrderViaApi(app, client.token, plumbingId);
    const mine = await request(app.getHttpServer())
      .get('/api/v1/planned-orders/mine')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].status).toBe('PUBLISHED');
  });
});
