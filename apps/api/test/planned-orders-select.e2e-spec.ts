import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp, resetDb, seedCategories, loginAs, createActiveMaster,
  createPlannedOrderViaApi, grantLeadCredits,
} from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { PlannedOrdersService } from '../src/planned-orders/planned-orders.service';

describe('Выбор и подтверждение мастера (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plannedOrders: PlannedOrdersService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let m1: { token: string; userId: string };
  let m2: { token: string; userId: string };

  async function bid(token: string, orderId: string, price: number) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${orderId}/bids`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price, term: 'завтра' })
      .expect(201);
    return res.body;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    plannedOrders = app.get(PlannedOrdersService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77090100001');
    m1 = await createActiveMaster(app, '+77090100002', plumbingId);
    m2 = await createActiveMaster(app, '+77090100003', plumbingId);
    await grantLeadCredits(app, m1.userId, 5);
    await grantLeadCredits(app, m2.userId, 5);
  });

  it('выбор → MASTER_SELECTED; телефон мастера клиенту ещё скрыт', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const b1 = await bid(m1.token, order.id, 8000);
    await bid(m2.token, order.id, 9000);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: b1.id })
      .expect(201);
    expect(res.body.status).toBe('MASTER_SELECTED');
    expect(res.body.master.id).toBe(m1.userId);
    expect(res.body.master.phone).toBe('');
  });

  it('подтверждение мастером → CONFIRMED, телефон раскрыт клиенту, цена = ставке', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const b1 = await bid(m1.token, order.id, 8000);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: b1.id })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/confirm`)
      .set('Authorization', `Bearer ${m1.token}`)
      .expect(201);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.workPrice).toBe(8000);

    const clientView = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(clientView.body.master.phone).toBeTruthy();
  });

  it('явный decline и джоба-таймаут возвращают заявку в PUBLISHED с сохранением бидов', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const b1 = await bid(m1.token, order.id, 8000);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: b1.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/decline`)
      .set('Authorization', `Bearer ${m1.token}`)
      .expect(201);

    const fresh = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh).toMatchObject({ status: 'PUBLISHED', masterId: null, selectedBidId: null });
    expect(await prisma.plannedOrderBid.count({ where: { plannedOrderId: order.id } })).toBe(1);

    // повторный выбор того же бида работает после возврата в PUBLISHED
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: b1.id })
      .expect(201);

    // джоба-таймаут на уже неактуальный bidId (устаревший) — no-op
    await plannedOrders.handleConfirmTimeout({ plannedOrderId: order.id, bidId: 'stale-bid-id' });
    const stillSelected = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(stillSelected.status).toBe('MASTER_SELECTED');

    // реальный таймаут по актуальному bidId возвращает в PUBLISHED
    await plannedOrders.handleConfirmTimeout({ plannedOrderId: order.id, bidId: stillSelected.selectedBidId! });
    const afterTimeout = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterTimeout.status).toBe('PUBLISHED');
  });

  it('устаревшая джоба-таймаут от первого выбора не трогает второй, реально текущий выбор', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const b1 = await bid(m1.token, order.id, 8000);
    const b2 = await bid(m2.token, order.id, 9000);

    // клиент выбирает бид m1 (b1) — это "джоба A" с payload bidId = b1.id
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: b1.id })
      .expect(201);
    const afterFirstSelect = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterFirstSelect.selectedBidId).toBe(b1.id);

    // возврат в PUBLISHED после первого выбора — джоба A по b1.id реально сработала бы здесь
    await plannedOrders.handleConfirmTimeout({ plannedOrderId: order.id, bidId: b1.id });
    const afterRevert = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterRevert).toMatchObject({ status: 'PUBLISHED', masterId: null, selectedBidId: null });

    // клиент выбирает ДРУГОЙ бид — m2 (b2). Это "джоба B" с payload bidId = b2.id
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/select`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ bidId: b2.id })
      .expect(201);
    const afterSecondSelect = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterSecondSelect).toMatchObject({
      status: 'MASTER_SELECTED',
      masterId: m2.userId,
      selectedBidId: b2.id,
    });

    // устаревшая джоба A (payload b1.id) срабатывает ПОСЛЕ того, как выбор уже сменился на b2 — no-op
    await plannedOrders.handleConfirmTimeout({ plannedOrderId: order.id, bidId: b1.id });
    const afterStaleJob = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterStaleJob).toMatchObject({
      status: 'MASTER_SELECTED',
      masterId: m2.userId,
      selectedBidId: b2.id,
    });

    // актуальная джоба B (payload b2.id) реально возвращает заявку в PUBLISHED
    await plannedOrders.handleConfirmTimeout({ plannedOrderId: order.id, bidId: b2.id });
    const afterCurrentJob = await prisma.plannedOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterCurrentJob).toMatchObject({ status: 'PUBLISHED', masterId: null, selectedBidId: null });

    // оба бида остаются в базе — реверт ничего не удаляет
    expect(await prisma.plannedOrderBid.count({ where: { plannedOrderId: order.id } })).toBe(2);
  });
});
