import { INestApplication } from '@nestjs/common';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

describe('Матчинг волнами (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let plumbingId: string;
  let electricsId: string;
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const cats = await seedCategories(app);
    plumbingId = cats.plumbing.id;
    electricsId = cats.electrics.id;
    client = await loginAs(app, '+77050000001');
  });

  it('волна 1: офферы только мастерам в 3 км нужной категории', async () => {
    const near = await createActiveMaster(app, '+77050000002', plumbingId, pointAtKm(2));
    await createActiveMaster(app, '+77050000003', plumbingId, pointAtKm(5)); // дальше 3 км
    await createActiveMaster(app, '+77050000004', electricsId, pointAtKm(1)); // не та категория
    const order = await createOrderViaApi(app, client.token, plumbingId);

    await matching.handleWave({ orderId: order.id, wave: 1 });

    const offers = await prisma.orderOffer.findMany({ where: { orderId: order.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ masterUserId: near.userId, wave: 1, outcome: 'PENDING', attempt: 1 });
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.wave).toBe(1);
  });

  it('пустая волна 1 → сразу волна 2 без таймаута', async () => {
    const mid = await createActiveMaster(app, '+77050000005', plumbingId, pointAtKm(5));
    const order = await createOrderViaApi(app, client.token, plumbingId);

    await matching.handleWave({ orderId: order.id, wave: 1 });

    const offers = await prisma.orderOffer.findMany({ where: { orderId: order.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ masterUserId: mid.userId, wave: 2 });
  });

  it('таймаут волны: PENDING → EXPIRED, следующая волна получает новых', async () => {
    await createActiveMaster(app, '+77050000006', plumbingId, pointAtKm(2));
    const far = await createActiveMaster(app, '+77050000007', plumbingId, pointAtKm(5));
    const order = await createOrderViaApi(app, client.token, plumbingId);

    await matching.handleWave({ orderId: order.id, wave: 1 });
    await matching.handleWaveTimeout({ orderId: order.id, wave: 1, attempt: 1 });

    const expired = await prisma.orderOffer.findMany({ where: { orderId: order.id, outcome: 'EXPIRED' } });
    expect(expired).toHaveLength(1);
    const wave2 = await prisma.orderOffer.findMany({ where: { orderId: order.id, wave: 2 } });
    expect(wave2.map((o) => o.masterUserId)).toEqual([far.userId]);
  });

  it('все волны пусты → NO_MASTERS и VOID холда', async () => {
    const master = await createActiveMaster(app, '+77050000008', plumbingId, pointAtKm(2));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await prisma.masterPresence.updateMany({ where: { masterUserId: master.userId }, data: { isOnline: false } });

    await matching.handleWave({ orderId: order.id, wave: 1 });

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe('NO_MASTERS');
    const voidTx = await prisma.paymentTransaction.findFirst({ where: { orderId: order.id, type: 'VOID' } });
    expect(voidTx).not.toBeNull();
  });

  it('идемпотентность: заявка не в SEARCHING → волна ничего не делает', async () => {
    await createActiveMaster(app, '+77050000009', plumbingId, pointAtKm(2));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED_BY_CLIENT' } });

    await matching.handleWave({ orderId: order.id, wave: 1 });

    expect(await prisma.orderOffer.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('гонка: два параллельных handleWave для одной волны создают офферы только один раз', async () => {
    const near = await createActiveMaster(app, '+77050000010', plumbingId, pointAtKm(2));
    const order = await createOrderViaApi(app, client.token, plumbingId);

    await Promise.all([
      matching.handleWave({ orderId: order.id, wave: 1 }),
      matching.handleWave({ orderId: order.id, wave: 1 }),
    ]);

    const offers = await prisma.orderOffer.findMany({ where: { orderId: order.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ masterUserId: near.userId, wave: 1, outcome: 'PENDING', attempt: 1 });
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.wave).toBe(1);
  });

  it('гонка: устаревшая волна (wave отставший) не создаёт офферы поверх более новой', async () => {
    const near = await createActiveMaster(app, '+77050000011', plumbingId, pointAtKm(2));
    const order = await createOrderViaApi(app, client.token, plumbingId);

    // Реальная волна 2 уже прошла (order.wave = 2 в БД), но приходит устаревшая
    // джоба волны 1 (например, redelivery pg-boss после долгого воркера).
    await prisma.order.update({ where: { id: order.id }, data: { wave: 2 } });

    await matching.handleWave({ orderId: order.id, wave: 1 });

    // wave:{lt:1} не матчит wave=2 → гейт не прошёл → офферов нет, wave не откатился.
    expect(await prisma.orderOffer.count({ where: { orderId: order.id } })).toBe(0);
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.wave).toBe(2);
    void near; // мастер существовал бы как кандидат, если бы гейт не сработал
  });

  it('гонка: устаревший вызов с пустой волной 1 не эскалирует и не гасит заявку (ветка нулевых кандидатов)', async () => {
    // Мастер онлайн на момент создания заявки (нужен, чтобы pricing.quote нашёл его
    // в радиусе 10 км и заявка вообще создалась), но офлайн к моменту handleWave —
    // findCandidates для ЛЮБОЙ волны (1/2/3) гарантированно вернёт [], так что без
    // Fix 2 код рекурсивно дойдёт до MAX_WAVE и вызовет markNoMasters по-настоящему
    // (это отличает тест от предыдущих "гонка:*", где кандидат был в радиусе волны 1
    // и Fix 1 сам по себе блокировал escalation через гейт-транзакцию на волне 2).
    const master = await createActiveMaster(app, '+77050000012', plumbingId, pointAtKm(2));
    const order = await createOrderViaApi(app, client.token, plumbingId);
    await prisma.masterPresence.updateMany({ where: { masterUserId: master.userId }, data: { isOnline: false } });

    // Симулируем состояние, которое оставил бы победивший конкурентный вызов:
    // волна уже продвинута до 2 (тем же способом, что и в предыдущем тесте).
    await prisma.order.update({ where: { id: order.id }, data: { wave: 2 } });

    await matching.handleWave({ orderId: order.id, wave: 1 });

    // Устаревший вызов должен молча выйти: не откатывать wave, не переводить в
    // NO_MASTERS (это случилось бы при неограниченной эскалации до MAX_WAVE) и не
    // трогать офферы/холд.
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.wave).toBe(2);
    expect(updated!.status).toBe('SEARCHING');
    expect(await prisma.orderOffer.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.paymentTransaction.findFirst({ where: { orderId: order.id, type: 'VOID' } })).toBeNull();
  });

  it('заблокированный мастер (blockedUntil в будущем) не попадает в волну матчинга', async () => {
    const m1 = await createActiveMaster(app, '+77050000013', plumbingId, pointAtKm(2));
    const m2 = await createActiveMaster(app, '+77050000014', plumbingId, pointAtKm(2));
    await prisma.masterProfile.updateMany({
      where: { userId: m1.userId },
      data: { blockedUntil: new Date(Date.now() + 24 * 3600 * 1000) },
    });
    const order = await createOrderViaApi(app, client.token, plumbingId);

    await matching.handleWave({ orderId: order.id, wave: 1 });

    const offers = await prisma.orderOffer.findMany({ where: { orderId: order.id, wave: 1 } });
    expect(offers.map((o) => o.masterUserId)).not.toContain(m1.userId);
    expect(offers.map((o) => o.masterUserId)).toContain(m2.userId);
  });
});
