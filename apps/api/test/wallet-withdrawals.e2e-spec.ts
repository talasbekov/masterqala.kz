import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Вывод средств (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let master: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    master = await loginAs(app, '+77110000001');
    await prisma.masterWalletAccount.create({ data: { masterUserId: master.userId, balance: 20000 } });
  });

  it('баланс отдаётся, история изначально пуста', async () => {
    const balance = await request(app.getHttpServer())
      .get('/api/v1/wallet/balance')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(balance.body).toEqual({ balance: 20000 });

    const history = await request(app.getHttpServer())
      .get('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(history.body).toEqual([]);
  });

  it('успешный вывод списывает баланс и помечает PAID', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 8000 })
      .expect(201);
    expect(res.body).toMatchObject({ amount: 8000, status: 'PAID' });
    expect(res.body.paidAt).toBeTruthy();

    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(12000);

    const history = await request(app.getHttpServer())
      .get('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(history.body).toHaveLength(1);
  });

  it('недостаточно средств — 422, баланс не тронут', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 50000 })
      .expect(422);
    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(20000);
  });

  it('сумма меньше минимума — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 1000 })
      .expect(400);
  });

  it('у мастера без кошелька — 422 (баланс 0)', async () => {
    const fresh = await loginAs(app, '+77110000002');
    await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${fresh.token}`)
      .send({ amount: 5000 })
      .expect(422);
  });
});
