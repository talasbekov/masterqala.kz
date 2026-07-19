import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm, setMasterOffline } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

describe('Отмены по §3.9 и повторный поиск (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let m1: { token: string; userId: string };
  let m2: { token: string; userId: string };

  const post = (token: string, orderId: string, path: string) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/${path}`).set('Authorization', `Bearer ${token}`).send({});

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77090000001');
    m1 = await createActiveMaster(app, '+77090000002', plumbingId, pointAtKm(1));
    m2 = await createActiveMaster(app, '+77090000003', plumbingId, pointAtKm(2));
  });

  it('клиент отменяет до принятия: бесплатно, VOID, офферы EXPIRED', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(client.token, order.id, 'cancel').expect(201);

    const o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o!.status).toBe('CANCELLED_BY_CLIENT');
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'VOID' } })).toBe(1);
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'CAPTURE' } })).toBe(0);
    expect(await prisma.orderOffer.count({ where: { orderId: order.id, outcome: 'PENDING' } })).toBe(0);
    expect(await prisma.accrual.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('клиент отменяет после принятия: сбор удержан, компенсация мастеру', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(m1.token, order.id, 'accept').expect(201);
    await post(client.token, order.id, 'cancel').expect(201);

    const o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o!.status).toBe('CANCELLED_BY_CLIENT');
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'CAPTURE' } })).toBe(1);
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'VOID' } })).toBe(0);
    const accrual = await prisma.accrual.findUnique({ where: { orderId: order.id } });
    expect(accrual!.amount).toBe(o!.calloutPrice - o!.serviceFee);
  });

  it('клиент не может отменить в IN_PROGRESS (409)', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(m1.token, order.id, 'accept').expect(201);
    await post(m1.token, order.id, 'on-way').expect(201);
    await post(m1.token, order.id, 'on-site').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${order.id}/propose-price`)
      .set('Authorization', `Bearer ${m1.token}`)
      .send({ amount: 10000 })
      .expect(201);
    await post(client.token, order.id, 'confirm-price').expect(201);
    await post(client.token, order.id, 'cancel').expect(409);
  });

  it('мастер отменяет после принятия: заявка снова в поиске, отменивший исключён, штраф применён', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    await post(m1.token, order.id, 'accept').expect(201);
    await post(m1.token, order.id, 'cancel').expect(201);

    let o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o).toMatchObject({ status: 'SEARCHING', masterId: null, searchAttempt: 2, wave: 0 });

    const account = await prisma.leadCreditAccount.findUniqueOrThrow({ where: { masterUserId: m1.userId } });
    expect(account.balance).toBe(-2); // штраф применяется даже при нулевом стартовом балансе
    const penalty = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: m1.userId, type: 'PENALTY' } });
    expect(penalty.amount).toBe(-2);
    const profile = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: m1.userId } });
    expect(profile.priorityPenaltyUntil).toBeTruthy();
    expect(await prisma.masterCancellation.count({ where: { masterUserId: m1.userId, orderType: 'URGENT' } })).toBe(1);

    await matching.handleWave({ orderId: order.id, wave: 1 });
    const offers2 = await prisma.orderOffer.findMany({ where: { orderId: order.id, attempt: 2 } });
    expect(offers2.map((x) => x.masterUserId)).toEqual([m2.userId]); // m1 исключён

    await post(m2.token, order.id, 'accept').expect(201);
    o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o!.masterId).toBe(m2.userId);
    // capture был при первом принятии и не дублируется
    expect(await prisma.paymentTransaction.count({ where: { orderId: order.id, type: 'CAPTURE' } })).toBe(1);
  });

  it('3-я отмена мастером за 30 дней блокирует его на 7 дней', async () => {
    for (let i = 0; i < 3; i++) {
      // Каждая заявка переходит после отмены обратно в SEARCHING (активный статус для клиента),
      // поэтому новый клиент на каждую итерацию — иначе create() упадёт с 409 "уже есть активная заявка".
      const iterClient = await loginAs(app, `+7709000001${i}`);
      const order = await createOrderViaApi(app, iterClient.token, plumbingId);
      await matching.handleWave({ orderId: order.id, wave: 1 });
      await post(m1.token, order.id, 'accept').expect(201);
      await post(m1.token, order.id, 'cancel').expect(201);
    }
    const profile = await prisma.masterProfile.findUniqueOrThrow({ where: { userId: m1.userId } });
    expect(profile.blockedUntil).toBeTruthy();
    expect(profile.blockedUntil!.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
  });

  it('повторный поиск из NO_MASTERS: новый hold и новая попытка', async () => {
    await setMasterOffline(app, m1.userId);
    await setMasterOffline(app, m2.userId);
    // мастеров нет для волн, но для создания нужен хотя бы один онлайн — включим и выключим
    const m3 = await createActiveMaster(app, '+77090000004', plumbingId, pointAtKm(1));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await setMasterOffline(app, m3.userId);
    await matching.handleWave({ orderId: order.id, wave: 1 });
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.status).toBe('NO_MASTERS');

    await post(client.token, order.id, 'retry-search').expect(201);
    const o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o).toMatchObject({ status: 'SEARCHING', searchAttempt: 2 });
    const holds = await prisma.paymentTransaction.findMany({ where: { orderId: order.id, type: 'HOLD' } });
    expect(holds).toHaveLength(2);
    expect(holds.every((h) => h.amount === o!.calloutPrice)).toBe(true);
  });

  it('посторонний не может отменить (403)', async () => {
    const order = await createOrderViaApi(app, client.token, plumbingId);
    const stranger = await loginAs(app, '+77090000005');
    await post(stranger.token, order.id, 'cancel').expect(403);
  });
});
