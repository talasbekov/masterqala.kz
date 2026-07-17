import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Зачисление компенсации на баланс кошелька (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let orders: OrdersService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };

  const post = (token: string, orderId: string, path: string) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/${path}`).set('Authorization', `Bearer ${token}`).send({});

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
    orders = app.get(OrdersService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77100000001');
    master = await createActiveMaster(app, '+77100000002', plumbingId);
  });

  it('закрытие заявки начисляет компенсацию на баланс кошелька', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(master.token, order.id, 'accept').expect(201);
    await post(master.token, order.id, 'on-way').expect(201);
    await post(master.token, order.id, 'on-site').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/propose-price`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 10000 })
      .expect(201);
    await post(client.token, order.id, 'confirm-price').expect(201);
    await post(master.token, order.id, 'complete').expect(201);
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });

    await post(client.token, order.id, 'confirm-completion').expect(201);

    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(account.balance).toBe(fresh.calloutPrice - fresh.serviceFee);
  });

  it('повторный вызов авто-закрытия на уже закрытой заявке не задваивает баланс', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(master.token, order.id, 'accept').expect(201);
    await post(master.token, order.id, 'on-way').expect(201);
    await post(master.token, order.id, 'on-site').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/propose-price`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 10000 })
      .expect(201);
    await post(client.token, order.id, 'confirm-price').expect(201);
    await post(master.token, order.id, 'complete').expect(201);
    await post(client.token, order.id, 'confirm-completion').expect(201);

    await orders.handleAutoClose({ orderId: order.id }); // заявка уже CLOSED — должен быть no-op

    const account = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(account.balance).toBe(fresh.calloutPrice - fresh.serviceFee);
  });
});
