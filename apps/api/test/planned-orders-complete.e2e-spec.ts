import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createPlannedOrderViaApi, grantLeadCredits } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { PlannedOrdersService } from '../src/planned-orders/planned-orders.service';

describe('Выполнение и закрытие плановой заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plannedOrders: PlannedOrdersService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };

  async function fullyConfirmed() {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const bidRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 7000, term: 'сегодня' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: bidRes.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    return order.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    plannedOrders = app.get(PlannedOrdersService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77090200001');
    master = await createActiveMaster(app, '+77090200002', plumbingId);
    await grantLeadCredits(app, master.userId, 5);
  });

  it('полный цикл: on-site → complete → confirm-completion → CLOSED', async () => {
    const orderId = await fullyConfirmed();
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/on-site`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/confirm-completion`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);
    expect(res.body.status).toBe('CLOSED');
  });

  it('джоба авто-закрытия закрывает заявку из DONE', async () => {
    const orderId = await fullyConfirmed();
    await request(app.getHttpServer()).post(`/api/v1/planned-orders/${orderId}/on-site`).set('Authorization', `Bearer ${master.token}`).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/planned-orders/${orderId}/complete`).set('Authorization', `Bearer ${master.token}`).expect(201);

    await plannedOrders.handleAutoClose({ plannedOrderId: orderId });
    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(fresh.status).toBe('CLOSED');
  });

  it('джоба истечения публикации: без ставок → EXPIRED, со ставками → no-op', async () => {
    const empty = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await plannedOrders.handlePlannedExpiry({ plannedOrderId: empty.id });
    const expired = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: empty.id } });
    expect(expired.status).toBe('EXPIRED');

    const withBid = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${withBid.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 5000, term: 'завтра' })
      .expect(201);
    await plannedOrders.handlePlannedExpiry({ plannedOrderId: withBid.id });
    const stillPublished = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: withBid.id } });
    expect(stillPublished.status).toBe('PUBLISHED');
  });
});
