import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createPlannedOrderViaApi, grantLeadCredits } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Отмена плановой заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };

  async function bidAndSelect(orderId: string, price = 7000) {
    const bidRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price, term: 'сегодня' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: bidRes.body.id })
      .expect(201);
    return bidRes.body.id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77090300001');
    master = await createActiveMaster(app, '+77090300002', plumbingId);
    await grantLeadCredits(app, master.userId, 5);
  });

  it('клиент отменяет до выбора мастера: бесплатно, кредит мастера не возвращается', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 7000, term: 'сегодня' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);

    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe('CANCELLED_BY_CLIENT');
    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(4); // потратил 1 на ставку, возврата нет
  });

  it('клиент отменяет после выбора мастера: кредит возвращается полностью выбранному', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await bidAndSelect(order.id);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);

    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe('CANCELLED_BY_CLIENT');
    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(5); // потратил 1, вернули 1
    const refund = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: master.userId, type: 'REFUND' } });
    expect(refund.amount).toBe(1);
  });

  it('мастер отменяет после подтверждения: −2 кредита, штраф приоритета, заявка снова PUBLISHED', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await bidAndSelect(order.id);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh).toMatchObject({ status: 'PUBLISHED', masterId: null, selectedBidId: null });
    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(2); // 5 - 1(ставка) - 2(штраф)
    const profile = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: master.userId } });
    expect(profile.priorityPenaltyUntil).toBeTruthy();
  });

  it('мастер не может отменить до подтверждения (409)', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await bidAndSelect(order.id);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(409);
  });

  it('посторонний не может отменить (403)', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const stranger = await loginAs(app, '+77090300099');
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);
  });
});
