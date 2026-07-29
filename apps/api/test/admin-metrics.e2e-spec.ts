import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  resetDb,
  seedCategories,
  loginAs,
  createActiveMaster,
  createOrderViaApi,
  createPlannedOrderViaApi,
} from './helpers';

describe('Admin metrics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('reports dashboard aggregates including stuck searches', async () => {
    const categories = await seedCategories(app);
    const operator = await loginAs(app, '+77010000001', 'OPERATOR');
    const client = await loginAs(app, '+77010000002');
    const master = await createActiveMaster(app, '+77010000003', categories.plumbing.id);

    const stuck = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: stuck.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    const pendingApplicant = await loginAs(app, '+77010000004');
    await prisma.masterProfile.create({
      data: {
        userId: pendingApplicant.userId,
        fullName: 'В ожидании',
        iin: '000000000000',
        district: 'Есильский район',
        experienceYears: 1,
        status: 'PENDING_REVIEW',
      },
    });

    // DONE заказ — терминальный статус, не должен попадать в activeUrgentCount.
    // Отдельный клиент: у одного клиента не может быть двух активных заявок одновременно (409).
    const secondClient = await loginAs(app, '+77010000005');
    const doneOrder = await createOrderViaApi(app, secondClient.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: doneOrder.id },
      data: { status: 'DONE', masterId: master.userId, acceptedAt: new Date(), completedAt: new Date() },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/metrics')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(res.body.activeUrgentCount).toBeGreaterThanOrEqual(1);
    // stuck (SEARCHING) считается, doneOrder (DONE) — нет: разница ровно 1.
    const beforeDone = res.body.activeUrgentCount;
    const stillDone = await prisma.order.count({ where: { status: 'DONE' } });
    expect(stillDone).toBe(1);
    expect(beforeDone).toBeGreaterThanOrEqual(1);
    expect(res.body.pendingVerificationCount).toBe(1);
    expect(res.body.stuckSearches).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: stuck.id, wave: 3 })]),
    );
    // DONE-заказ не должен фигурировать среди "зависших" (он не в статусе SEARCHING в любом случае),
    // и не должен раздувать activeUrgentCount — проверяем явно через прямой count в БД.
    const nonTerminalCount = await prisma.order.count({
      where: { status: { in: ['CREATED', 'SEARCHING', 'ACCEPTED', 'MASTER_ON_WAY', 'INSPECTION', 'AWAITING_PRICE_CONFIRM', 'IN_PROGRESS'] } },
    });
    expect(res.body.activeUrgentCount).toBe(nonTerminalCount);
  });

  it('computes foundMasterRate and medianSearchSeconds from decided orders in the 24h window', async () => {
    const categories = await seedCategories(app);
    const operator = await loginAs(app, '+77010000001', 'OPERATOR');
    const client = await loginAs(app, '+77010000002');
    const master = await createActiveMaster(app, '+77010000003', categories.plumbing.id);

    // Заказ без мастера: должен войти в знаменатель (decided), но не в числитель.
    // Создаём ДО того, как мастер станет занят принятой заявкой — иначе matching не найдёт
    // ни одного мастера рядом и создание заявки провалится с 422 ещё до того, как мы
    // успеем перевести её в NO_MASTERS вручную.
    // Отдельный клиент: у одного клиента не может быть двух активных заявок одновременно (409).
    const secondClient = await loginAs(app, '+77010000006');
    const noMasters = await createOrderViaApi(app, secondClient.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: noMasters.id },
      data: { status: 'NO_MASTERS' },
    });

    // Принятый заказ: должен войти в accepted-часть foundMasterRate и в median.
    const accepted = await createOrderViaApi(app, client.token, categories.plumbing.id);
    const createdAt = new Date(Date.now() - 60_000);
    const acceptedAt = new Date(Date.now() - 30_000);
    await prisma.order.update({
      where: { id: accepted.id },
      data: { status: 'ACCEPTED', masterId: master.userId, createdAt, acceptedAt },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/metrics')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(typeof res.body.foundMasterRate).toBe('number');
    expect(res.body.foundMasterRate).toBeGreaterThanOrEqual(0);
    expect(res.body.foundMasterRate).toBeLessThanOrEqual(100);
    // 1 accepted / 2 decided = 50%.
    expect(res.body.foundMasterRate).toBe(50);

    expect(typeof res.body.medianSearchSeconds).toBe('number');
    expect(res.body.medianSearchSeconds).not.toBeNull();
    expect(res.body.medianSearchSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns null foundMasterRate and medianSearchSeconds when no orders were decided in the window', async () => {
    await seedCategories(app);
    const operator = await loginAs(app, '+77010000001', 'OPERATOR');

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/metrics')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(res.body.foundMasterRate).toBeNull();
    expect(res.body.medianSearchSeconds).toBeNull();
  });

  it('reflects publishedPlannedCount and pendingWithdrawalsCount as numbers with real fixtures', async () => {
    const categories = await seedCategories(app);
    const operator = await loginAs(app, '+77010000001', 'OPERATOR');
    const client = await loginAs(app, '+77010000002');
    const master = await createActiveMaster(app, '+77010000003', categories.plumbing.id);

    await createPlannedOrderViaApi(app, client.token, categories.plumbing.id);

    await prisma.withdrawalRequest.create({
      data: { masterUserId: master.userId, amount: 5000, status: 'PENDING' },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/metrics')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(typeof res.body.publishedPlannedCount).toBe('number');
    expect(res.body.publishedPlannedCount).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.pendingWithdrawalsCount).toBe('number');
    expect(res.body.pendingWithdrawalsCount).toBeGreaterThanOrEqual(1);
  });
});
