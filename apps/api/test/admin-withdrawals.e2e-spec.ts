import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin: заявки на вывод (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(async () => { await resetDb(app); });

  it('клиенту доступ запрещён → 403', async () => {
    const { token } = await loginAs(app, '+77120000001');
    await request(app.getHttpServer())
      .get('/api/v1/admin/withdrawals')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('оператор видит список с маскированным телефоном', async () => {
    const master = await loginAs(app, '+77120000002');
    await prisma.masterWalletAccount.create({ data: { masterUserId: master.userId, balance: 20000 } });
    const withdrawal = await prisma.withdrawalRequest.create({
      data: { masterUserId: master.userId, amount: 8000, status: 'PAID', paidAt: new Date() },
    });

    const { token: opToken } = await loginAs(app, '+77000000001', 'OPERATOR');
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/withdrawals')
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: withdrawal.id, amount: 8000, status: 'PAID' });
    expect(list.body[0].master.phone).toBe('0002'); // последние 4 цифры +77120000002
    expect(list.body[0].payoutPhone).toBeNull(); // заявка создана без снимка реквизитов
  });

  it('реквизиты выплаты показаны маскированными, отдельно от логин-телефона мастера', async () => {
    const master = await loginAs(app, '+77120000003');
    await prisma.masterWalletAccount.create({ data: { masterUserId: master.userId, balance: 20000 } });
    await prisma.withdrawalRequest.create({
      data: { masterUserId: master.userId, amount: 5000, status: 'PAID', paidAt: new Date(), payoutPhone: '+77019998877' },
    });

    const { token: opToken } = await loginAs(app, '+77000000002', 'OPERATOR');
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/withdrawals')
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);

    expect(list.body[0].payoutPhone).toBe('8877');
    expect(list.body[0].master.phone).toBe('0003'); // логин-телефон, другое число
  });

  it('клиенту resolve запрещён → 403', async () => {
    const { token } = await loginAs(app, '+77120000004');
    await request(app.getHttpServer())
      .post('/api/v1/admin/withdrawals/whatever/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ outcome: 'PAID', note: 'x' })
      .expect(403);
  });

  it('resolve outcome=PAID: статус PAID, баланс не трогает, пишет журнал', async () => {
    const master = await loginAs(app, '+77120000005');
    await prisma.masterWalletAccount.create({ data: { masterUserId: master.userId, balance: 5000 } });
    const withdrawal = await prisma.withdrawalRequest.create({
      data: {
        masterUserId: master.userId,
        amount: 8000,
        status: 'ERROR',
        errorMessage: 'ECONNRESET: провайдер недоступен',
        payoutPhone: '+77019998877',
      },
    });

    const { token: opToken } = await loginAs(app, '+77000000003', 'OPERATOR');
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawal.id}/resolve`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ outcome: 'PAID', reference: 'kaspi-stmt-42', note: 'сверено по выписке Kaspi' })
      .expect(201);

    expect(res.body).toMatchObject({ status: 'PAID', providerRef: 'kaspi-stmt-42' });
    expect(res.body.paidAt).toBeTruthy();

    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(5000); // не тронут — деньги уже считались списанными

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { targetId: withdrawal.id } });
    expect(audit).toMatchObject({
      actorType: 'OPERATOR',
      action: 'WITHDRAWAL_RESOLVED_PAID',
      targetType: 'WITHDRAWAL',
      comment: 'сверено по выписке Kaspi',
    });
  });

  it('resolve outcome=FAILED: статус FAILED, сумма возвращается на баланс', async () => {
    const master = await loginAs(app, '+77120000006');
    await prisma.masterWalletAccount.create({ data: { masterUserId: master.userId, balance: 5000 } });
    const withdrawal = await prisma.withdrawalRequest.create({
      data: { masterUserId: master.userId, amount: 8000, status: 'ERROR', payoutPhone: '+77019998877' },
    });

    const { token: opToken } = await loginAs(app, '+77000000004', 'OPERATOR');
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawal.id}/resolve`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ outcome: 'FAILED', note: 'платёж не найден в выписке' })
      .expect(201);

    expect(res.body.status).toBe('FAILED');

    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(13000); // 5000 + возврат 8000
  });

  it('resolve заявки не в ERROR — 409, ничего не меняет', async () => {
    const master = await loginAs(app, '+77120000007');
    await prisma.masterWalletAccount.create({ data: { masterUserId: master.userId, balance: 5000 } });
    const withdrawal = await prisma.withdrawalRequest.create({
      data: { masterUserId: master.userId, amount: 8000, status: 'PAID', paidAt: new Date() },
    });

    const { token: opToken } = await loginAs(app, '+77000000005', 'OPERATOR');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/withdrawals/${withdrawal.id}/resolve`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ outcome: 'FAILED', note: 'x' })
      .expect(409);

    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(5000); // не тронут повторным разрешением
  });

  it('resolve без комментария — 400', async () => {
    const { token: opToken } = await loginAs(app, '+77000000006', 'OPERATOR');
    await request(app.getHttpServer())
      .post('/api/v1/admin/withdrawals/whatever/resolve')
      .set('Authorization', `Bearer ${opToken}`)
      .send({ outcome: 'PAID' })
      .expect(400);
  });
});
