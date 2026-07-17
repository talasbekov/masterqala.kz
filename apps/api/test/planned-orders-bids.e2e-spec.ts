import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp, resetDb, seedCategories, loginAs, createActiveMaster,
  createPlannedOrderViaApi, grantLeadCredits,
} from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Ставки на плановую заявку (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let masters: { token: string; userId: string }[];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77080000001');
    masters = [];
    for (let i = 0; i < 6; i++) {
      const m = await createActiveMaster(app, `+7708000001${i}`, plumbingId);
      await grantLeadCredits(app, m.userId, 5);
      masters.push(m);
    }
  });

  it('ставка списывает 1 кредит и создаёт запись', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[0].token}`)
      .send({ price: 8000, term: 'сегодня до 18:00', comment: 'есть всё оборудование' })
      .expect(201);
    expect(res.body).toMatchObject({ price: 8000, term: 'сегодня до 18:00' });

    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: masters[0].userId } });
    expect(account.balance).toBe(4);
    const tx = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: masters[0].userId } });
    expect(tx).toMatchObject({ type: 'SPEND', amount: 1 });
  });

  it('недостаточно кредитов — 422, повторный отклик тем же мастером — 409', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const poor = await createActiveMaster(app, '+77080000099', plumbingId); // без кредитов
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${poor.token}`)
      .send({ price: 8000, term: 'завтра' })
      .expect(422);

    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[0].token}`)
      .send({ price: 8000, term: 'завтра' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[0].token}`)
      .send({ price: 9000, term: 'завтра' })
      .expect(409);
  });

  it('лимит 5 мастеров на заявку', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post(`/api/v1/planned-orders/${order.id}/bids`)
        .set('Authorization', `Bearer ${masters[i].token}`)
        .send({ price: 8000, term: 'завтра' })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[5].token}`)
      .send({ price: 8000, term: 'завтра' })
      .expect(422);
  });

  it('заблокированный мастер не может сделать ставку (422)', async () => {
    await prisma.masterProfile.updateMany({
      where: { userId: masters[0].userId },
      data: { blockedUntil: new Date(Date.now() + 24 * 3600 * 1000) },
    });
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[0].token}`)
      .send({ price: 7000, term: 'сегодня' })
      .expect(422);
  });

  it('мастер с истёкшей блокировкой снова может делать ставки', async () => {
    await prisma.masterProfile.updateMany({
      where: { userId: masters[0].userId },
      data: { blockedUntil: new Date(Date.now() - 1000) },
    });
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${masters[0].token}`)
      .send({ price: 7000, term: 'сегодня' })
      .expect(201);
  });
});
