import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

describe('Отзывы о мастере (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let orderId: string;

  const post = (token: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/${path}`).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77090000001');
    master = await createActiveMaster(app, '+77090000002', plumbingId, pointAtKm(1));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    orderId = order.id;
    await app.get(MatchingService).handleWave({ orderId, wave: 1 });
    await post(master.token, 'accept').expect(201);
    await post(master.token, 'on-way').expect(201);
    await post(master.token, 'on-site').expect(201);
    await post(master.token, 'propose-price', { amount: 15000 }).expect(201);
    await post(client.token, 'confirm-price').expect(201);
    await post(master.token, 'complete').expect(201);
    await post(client.token, 'confirm-completion').expect(201);
  });

  it('клиент оставляет отзыв после закрытия — рейтинг мастера появляется в ответе API', async () => {
    const res = await post(client.token, 'review', { rating: 5, comment: 'Отлично!' }).expect(201);
    expect(res.body).toMatchObject({ rating: 5, comment: 'Отлично!', masterUserId: master.userId });

    const review = await prisma.review.findUnique({ where: { orderId } });
    expect(review).toMatchObject({ rating: 5, clientId: client.userId, masterUserId: master.userId });
  });

  it('повторный отзыв на ту же заявку — 409', async () => {
    await post(client.token, 'review', { rating: 4 }).expect(201);
    await post(client.token, 'review', { rating: 2 }).expect(409);
  });

  it('до закрытия заявки — 409', async () => {
    const other = await loginAs(app, '+77090000003');
    const otherMaster = await createActiveMaster(app, '+77090000004', plumbingId, pointAtKm(1));
    const fresh = await createOrderViaApi(app, other.token, plumbingId);
    await app.get(MatchingService).handleWave({ orderId: fresh.id, wave: 1 });
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${fresh.id}/accept`)
      .set('Authorization', `Bearer ${otherMaster.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${fresh.id}/review`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ rating: 5 })
      .expect(409);
  });

  it('не клиент заявки — 403', async () => {
    const stranger = await loginAs(app, '+77090000005');
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/review`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ rating: 5 })
      .expect(403);
  });

  it('rating вне 1..5 — 400', async () => {
    await post(client.token, 'review', { rating: 6 }).expect(400);
    await post(client.token, 'review', { rating: 0 }).expect(400);
  });

  it('GET /orders/:id отдаёт rating/reviewCount мастера после отзыва', async () => {
    await post(client.token, 'review', { rating: 5 }).expect(201);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(detail.body.master).toMatchObject({ rating: 5, reviewCount: 1 });
  });
});
