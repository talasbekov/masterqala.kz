import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createPlannedOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Плановая заявка: полный жизненный цикл (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77099900001');
    master = await createActiveMaster(app, '+77099900002', plumbingId);
  });

  it('покупка кредита → публикация → ставка → выбор → подтверждение → выполнение → закрытие', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'single' })
      .expect(201);

    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);

    const bidRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 9000, term: 'завтра утром', comment: 'привезу материалы' })
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

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/on-site`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);

    const final = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm-completion`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);

    expect(final.body.status).toBe('CLOSED');
    expect(final.body.workPrice).toBe(9000);

    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(0); // 1 куплен, 1 потрачен на ставку
  });

  it('confirmDeadline = selectedAt + 2 часа', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'single' })
      .expect(201);
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const bidRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 9000, term: 'завтра утром' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: bidRes.body.id })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    const selectedAt = new Date(detail.body.selectedAt).getTime();
    const deadline = new Date(detail.body.confirmDeadline).getTime();
    expect(deadline - selectedAt).toBe(2 * 3600 * 1000);
  });

  it('отзыв после закрытия — рейтинг мастера появляется в ставках следующей заявки', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'single' })
      .expect(201);
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const bidRes = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 9000, term: 'завтра утром' })
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
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/on-site`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${master.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm-completion`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(201);

    const review = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/review`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ rating: 4, comment: 'Хорошо, но задержался' })
      .expect(201);
    expect(review.body).toMatchObject({ rating: 4, plannedOrderId: order.id, masterUserId: master.userId });

    // Новая заявка того же мастера — рейтинг виден в его ставке.
    await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'single' })
      .expect(201);
    const next = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const nextBid = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${next.id}/bids`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ price: 5000, term: 'сегодня' })
      .expect(201);
    void nextBid;
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${next.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(detail.body.bids[0].master).toMatchObject({ rating: 4, reviewCount: 1 });
  });
});
