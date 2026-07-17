import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Цепочка до цены и таймаут цены (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let orderId: string;

  const post = (token: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/${path}`).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    client = await loginAs(app, '+77070000001');
    master = await createActiveMaster(app, '+77070000002', plumbing.id, pointAtKm(1));
    const order = await createOrderViaApi(app, client.token, plumbing.id);
    orderId = order.id;
    await app.get(MatchingService).handleWave({ orderId, wave: 1 });
    await post(master.token, 'accept').expect(201);
  });

  it('еду → на месте → цена → подтверждение → В_РАБОТЕ', async () => {
    await post(master.token, 'on-way').expect(201);
    await post(master.token, 'on-site').expect(201);
    await post(master.token, 'propose-price', { amount: 15000, comment: 'Замена смесителя' }).expect(201);
    let o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o).toMatchObject({ status: 'AWAITING_PRICE_CONFIRM', workPrice: 15000, workComment: 'Замена смесителя' });
    expect(o!.priceProposedAt).not.toBeNull();

    await post(client.token, 'confirm-price').expect(201);
    o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('IN_PROGRESS');
  });

  it('пропуск шага — 409, чужой пользователь — 403', async () => {
    await post(master.token, 'on-site').expect(409); // ACCEPTED, а не MASTER_ON_WAY
    await post(client.token, 'on-way').expect(403); // клиент не мастер заявки
    await post(master.token, 'confirm-price').expect(403); // мастер не клиент
  });

  it('отклонение цены → ОТМЕНЕНА_КЛИЕНТОМ + начисление компенсации', async () => {
    await post(master.token, 'on-way').expect(201);
    await post(master.token, 'on-site').expect(201);
    await post(master.token, 'propose-price', { amount: 20000 }).expect(201);
    await post(client.token, 'reject-price').expect(201);
    const o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('CANCELLED_BY_CLIENT');
    const accrual = await prisma.accrual.findUnique({ where: { orderId } });
    expect(accrual).toMatchObject({ masterUserId: master.userId, amount: o!.calloutPrice - o!.serviceFee });
  });

  it('таймаут цены (хендлер) → авто-отмена + начисление; идемпотентен', async () => {
    await post(master.token, 'on-way').expect(201);
    await post(master.token, 'on-site').expect(201);
    await post(master.token, 'propose-price', { amount: 20000 }).expect(201);
    await orders.handlePriceTimeout({ orderId });
    const o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('CANCELLED_BY_CLIENT');
    expect(o!.cancelReason).toContain('Таймаут');
    await orders.handlePriceTimeout({ orderId }); // не в AWAITING — тихо выходит
    expect(await prisma.accrual.count({ where: { orderId } })).toBe(1);
  });
});
