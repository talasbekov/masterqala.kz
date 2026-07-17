import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Разбор спора оператором (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let orders: OrdersService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let operator: { token: string; userId: string };
  let orderId: string;
  let disputeId: string;

  const post = (token: string, oid: string, path: string) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${oid}/${path}`).set('Authorization', `Bearer ${token}`).send({});

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
    client = await loginAs(app, '+77140000001');
    master = await createActiveMaster(app, '+77140000002', plumbingId);
    operator = await loginAs(app, '+77140000003', 'OPERATOR');

    const order = await createOrderViaApi(app, client.token, plumbingId);
    orderId = order.id;
    await matching.handleWave({ orderId, wave: 1 });
    await post(master.token, orderId, 'accept').expect(201);
    await post(master.token, orderId, 'on-way').expect(201);
    await post(master.token, orderId, 'on-site').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/propose-price`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 10000 })
      .expect(201);
    await post(client.token, orderId, 'confirm-price').expect(201);
    await post(master.token, orderId, 'complete').expect(201);

    const disputeRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Потоп' })
      .expect(201);
    disputeId = disputeRes.body.id;
  });

  it('оператор видит список открытых споров', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/disputes?status=OPEN')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(disputeId);
  });

  it('оператор видит деталь спора', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(res.body.reason).toBe('Потоп');
  });

  it('не-оператор не имеет доступа к списку споров (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/disputes')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);
  });

  it('оператор разрешает спор с возвратом сбора и штрафом мастеру: заявка DONE→CLOSED, сбор возвращён, штраф применён', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: true, penalizeMaster: true, resolutionNote: 'Подтверждено фото' })
      .expect(201);

    const dispute = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
    expect(dispute).toMatchObject({ status: 'RESOLVED', refundServiceFee: true, penalizeMaster: true });
    expect(dispute.resolvedByUserId).toBe(operator.userId);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('CLOSED'); // была DONE, заморожена спором, спор закрыт здесь же

    const penalty = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: master.userId, type: 'PENALTY' } });
    expect(penalty.amount).toBe(-2);
    // санкция за спор НЕ считается в окно блокировки за отмены (§3.9 vs §3.10 — разные основания)
    expect(await prisma.masterCancellation.count({ where: { masterUserId: master.userId } })).toBe(0);
  });

  it('оператор разрешает спор без санкций: заявка закрывается, штраф не применяется', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: false, penalizeMaster: false, resolutionNote: 'Не подтверждено' })
      .expect(201);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('CLOSED');
    expect(await prisma.leadCreditTransaction.count({ where: { masterUserId: master.userId, type: 'PENALTY' } })).toBe(0);
  });

  it('оператор разрешает спор без санкций: мастеру всё равно начисляется компенсация за выполненный вызов', async () => {
    const orderBefore = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: false, penalizeMaster: false, resolutionNote: 'Не подтверждено' })
      .expect(201);

    const accrual = await prisma.accrual.findFirstOrThrow({ where: { orderId, type: 'CALLOUT_COMPENSATION' } });
    const expectedAmount = orderBefore.calloutPrice - orderBefore.serviceFee;
    expect(accrual.amount).toBe(expectedAmount);
    expect(accrual.masterUserId).toBe(master.userId);

    const wallet = await prisma.masterWalletAccount.findUniqueOrThrow({ where: { masterUserId: master.userId } });
    expect(wallet.balance).toBe(expectedAmount);
  });

  it('повторное разрешение уже разрешённого спора — 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: false, penalizeMaster: false, resolutionNote: 'Первое решение' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: false, penalizeMaster: false, resolutionNote: 'Повтор' })
      .expect(409);
  });

  it('handleAutoClose после разрешения спора — идемпотентный no-op (заявка уже CLOSED)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ refundServiceFee: false, penalizeMaster: false, resolutionNote: 'ok' })
      .expect(201);
    await orders.handleAutoClose({ orderId }); // не должен бросить и не должен ничего менять
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('CLOSED');
  });
});
