import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp,
  resetDb,
  seedCategories,
  loginAs,
  createActiveMaster,
  createOrderViaApi,
  ALMATY,
  pointAtKm,
} from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Создание срочной заявки (e2e)', () => {
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
    client = await loginAs(app, '+77040000001');
    await createActiveMaster(app, '+77040000002', plumbingId, pointAtKm(2));
  });

  it('превью возвращает цену, при отсутствии мастеров — available:false', async () => {
    const ok = await request(app.getHttpServer())
      .post('/api/v1/orders/preview')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ categoryId: plumbingId, ...ALMATY })
      .expect(201);
    expect(ok.body.available).toBe(true);
    expect(ok.body.calloutPrice).toBeGreaterThanOrEqual(2000);
    expect(ok.body.serviceFee).toBeGreaterThanOrEqual(1000);

    await prisma.masterPresence.updateMany({ data: { isOnline: false } });
    const empty = await request(app.getHttpServer())
      .post('/api/v1/orders/preview')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ categoryId: plumbingId, ...ALMATY })
      .expect(201);
    expect(empty.body).toEqual({ available: false });
  });

  it('создание: заявка в SEARCHING, есть HOLD на полную стоимость выезда, гео записано', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    expect(order.status).toBe('SEARCHING');
    expect(order.serviceFee).toBeGreaterThanOrEqual(1000);
    expect(order.calloutPrice).toBeGreaterThan(order.serviceFee);
    const hold = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id, type: 'HOLD' },
    });
    expect(hold).toMatchObject({
      amount: order.calloutPrice,
      status: 'SUCCEEDED',
    });
    const [geo] = await prisma.$queryRaw<{ lat: number }[]>`
      SELECT ST_Y(location::geometry) AS lat FROM "Order" WHERE id = ${order.id}`;
    expect(geo.lat).toBeCloseTo(ALMATY.lat, 3);
  });

  it('вторая активная заявка — 409; после отмены создать можно', async () => {
    const first = await createOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'ещё',
        address: 'а',
        ...ALMATY,
      })
      .expect(409);
    await prisma.order.update({
      where: { id: first.id },
      data: { status: 'CANCELLED_BY_CLIENT' },
    });
    await createOrderViaApi(app, client.token, plumbingId);
  });

  it('нет мастеров в 10 км → 422', async () => {
    await prisma.masterPresence.updateMany({ data: { isOnline: false } });
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'т',
        address: 'а',
        ...ALMATY,
      })
      .expect(422);
  });

  it('GET /orders/active и GET /orders/:id с доступом', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    const active = await request(app.getHttpServer())
      .get('/api/v1/orders/active')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(active.body.order.id).toBe(order.id);

    const stranger = await loginAs(app, '+77040000003');
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);
  });
});
