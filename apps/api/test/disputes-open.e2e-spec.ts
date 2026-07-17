import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Открытие спора по срочной заявке (e2e)', () => {
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
    client = await loginAs(app, '+77120000001');
    master = await createActiveMaster(app, '+77120000002', plumbingId);
  });

  async function toDone(): Promise<string> {
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
    return order.id;
  }

  it('клиент открывает спор на заявке DONE', async () => {
    const orderId = await toDone();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Потоп после ремонта' })
      .expect(201);
    expect(res.body).toMatchObject({ orderId, openedByRole: 'CLIENT', status: 'OPEN', reason: 'Потоп после ремонта' });
    expect(await prisma.dispute.count({ where: { orderId } })).toBe(1);
  });

  it('повторное открытие спора на той же заявке — 409', async () => {
    const orderId = await toDone();
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Причина 1' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ reason: 'Причина 2' })
      .expect(409);
  });

  it('посторонний не может открыть спор (403)', async () => {
    const orderId = await toDone();
    const stranger = await loginAs(app, '+77120000099');
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ reason: 'Причина' })
      .expect(403);
  });

  it('открытый спор замораживает авто-закрытие: handleAutoClose не закрывает заявку', async () => {
    const orderId = await toDone();
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Причина' })
      .expect(201);

    await orders.handleAutoClose({ orderId });

    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(fresh.status).toBe('DONE'); // не CLOSED — спор открыт
  });

  it('без открытого спора handleAutoClose закрывает заявку как обычно', async () => {
    const orderId = await toDone();
    await orders.handleAutoClose({ orderId });
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(fresh.status).toBe('CLOSED');
  });

  it('заявка CLOSED в пределах 48ч окна — спор открывается', async () => {
    const orderId = await toDone();
    await orders.handleAutoClose({ orderId });
    await prisma.order.update({ where: { id: orderId }, data: { closedAt: new Date(Date.now() - 10 * 3600 * 1000) } });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Обнаружил дефект позже' })
      .expect(201);
    expect(res.body).toMatchObject({ orderId, status: 'OPEN' });
  });

  it('заявка CLOSED более 48ч назад — окно открытия спора истекло (409)', async () => {
    const orderId = await toDone();
    await orders.handleAutoClose({ orderId });
    await prisma.order.update({ where: { id: orderId }, data: { closedAt: new Date(Date.now() - 49 * 3600 * 1000) } });

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Слишком поздно' })
      .expect(409);
  });

  it('спор недоступен на этапе до on-site/complete (SEARCHING/ACCEPTED) — 409', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Слишком рано' })
      .expect(409);

    await post(master.token, order.id, 'accept').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Всё ещё рано' })
      .expect(409);
  });
});
