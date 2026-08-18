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
});
