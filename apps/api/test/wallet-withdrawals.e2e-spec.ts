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
    await prisma.masterProfile.create({
      data: {
        userId: master.userId,
        fullName: 'Мастер Тест',
        iin: '850101300123',
        district: 'Алмалинский',
        experienceYears: 5,
        status: 'ACTIVE',
        payoutPhone: '+77011112233',
      },
    });
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
    await prisma.masterProfile.create({
      data: {
        userId: fresh.userId,
        fullName: 'Мастер без кошелька',
        iin: '850101300124',
        district: 'Алмалинский',
        experienceYears: 5,
        status: 'ACTIVE',
        payoutPhone: '+77011112244',
      },
    });
    await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${fresh.token}`)
      .send({ amount: 5000 })
      .expect(422);
  });

  it('без реквизитов вывода — 409, до баланса дело не доходит', async () => {
    await prisma.masterProfile.update({ where: { userId: master.userId }, data: { payoutPhone: null } });
    await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 8000 })
      .expect(409);
    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(20000);
  });

  it('реквизиты: GET пустой изначально, PATCH нормализует и сохраняет, снимок попадает в заявку', async () => {
    const fresh = await loginAs(app, '+77110000003');
    await prisma.masterProfile.create({
      data: {
        userId: fresh.userId,
        fullName: 'Новый мастер',
        iin: '850101300125',
        district: 'Алмалинский',
        experienceYears: 5,
        status: 'ACTIVE',
      },
    });
    await prisma.masterWalletAccount.create({ data: { masterUserId: fresh.userId, balance: 10000 } });

    const empty = await request(app.getHttpServer())
      .get('/api/v1/wallet/payout-account')
      .set('Authorization', `Bearer ${fresh.token}`)
      .expect(200);
    expect(empty.body).toEqual({ payoutPhone: null });

    const set = await request(app.getHttpServer())
      .patch('/api/v1/wallet/payout-account')
      .set('Authorization', `Bearer ${fresh.token}`)
      .send({ phone: '8 (701) 555-66-77' })
      .expect(200);
    expect(set.body).toEqual({ payoutPhone: '+77015556677' });

    const withdrawal = await request(app.getHttpServer())
      .post('/api/v1/wallet/withdrawals')
      .set('Authorization', `Bearer ${fresh.token}`)
      .send({ amount: 8000 })
      .expect(201);
    expect(withdrawal.body.payoutPhone).toBe('+77015556677');
  });

  it('PATCH реквизитов отклоняет некорректный номер — 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/wallet/payout-account')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ phone: 'не телефон' })
      .expect(400);
  });

  it('PATCH реквизитов недоступен пользователю без профиля мастера — 403', async () => {
    const client = await loginAs(app, '+77110000004');
    await request(app.getHttpServer())
      .patch('/api/v1/wallet/payout-account')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ phone: '+77011112233' })
      .expect(403);
  });
});
