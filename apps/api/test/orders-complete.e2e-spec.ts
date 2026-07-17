import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Завершение заявки (e2e)', () => {
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
    client = await loginAs(app, '+77080000001');
    master = await createActiveMaster(app, '+77080000002', plumbing.id, pointAtKm(1));
    const order = await createOrderViaApi(app, client.token, plumbing.id);
    orderId = order.id;
    await app.get(MatchingService).handleWave({ orderId, wave: 1 });
    await post(master.token, 'accept').expect(201);
    await post(master.token, 'on-way').expect(201);
    await post(master.token, 'on-site').expect(201);
    await post(master.token, 'propose-price', { amount: 15000 }).expect(201);
    await post(client.token, 'confirm-price').expect(201);
  });

  it('happy path: выполнено → подтверждение клиентом → ЗАКРЫТА, начисление = выезд − сбор', async () => {
    await post(master.token, 'complete').expect(201);
    let o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('DONE');
    expect(o!.completedAt).not.toBeNull();

    await post(client.token, 'confirm-completion').expect(201);
    o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('CLOSED');
    expect(o!.closedAt).not.toBeNull();

    const accrual = await prisma.accrual.findUnique({ where: { orderId } });
    expect(accrual).toMatchObject({
      masterUserId: master.userId,
      type: 'CALLOUT_COMPENSATION',
      amount: o!.calloutPrice - o!.serviceFee,
    });
    // Полная история платежей: HOLD + CAPTURE, без VOID.
    const types = (await prisma.paymentTransaction.findMany({ where: { orderId } })).map((t) => t.type).sort();
    expect(types).toEqual(['CAPTURE', 'HOLD']);
  });

  it('авто-закрытие по джобе 24ч: DONE → CLOSED + начисление, идемпотентно', async () => {
    await post(master.token, 'complete').expect(201);
    await orders.handleAutoClose({ orderId });
    const o = await prisma.order.findUnique({ where: { id: orderId } });
    expect(o!.status).toBe('CLOSED');
    await orders.handleAutoClose({ orderId }); // повтор — тихий выход
    expect(await prisma.accrual.count({ where: { orderId } })).toBe(1);
  });

  it('подтвердить может только клиент, завершить — только мастер', async () => {
    await post(client.token, 'complete').expect(403);
    await post(master.token, 'complete').expect(201);
    await post(master.token, 'confirm-completion').expect(403);
  });
});
