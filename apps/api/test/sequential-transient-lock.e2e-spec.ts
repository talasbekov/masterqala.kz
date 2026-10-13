import { INestApplication } from '@nestjs/common';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { SequentialMatchingService } from '../src/orders/sequential-matching.service';

/** Real PostGIS test: no sleeps or mocked candidate/transaction results. */
describe('Sequential eligible-master transient lock recovery (PostGIS)', () => {
  let app: INestApplication;
  const previousMode = process.env.COMMERCIAL_MODE;
  beforeAll(async () => {
    process.env.COMMERCIAL_MODE = 'DIRECT_PAYMENT';
    app = await createTestApp();
  });
  afterAll(async () => {
    await app?.close();
    if (previousMode === undefined) delete process.env.COMMERCIAL_MODE;
    else process.env.COMMERCIAL_MODE = previousMode;
  });
  beforeEach(async () => resetDb(app));

  it('does not terminally exhaust search when its only eligible master is temporarily row-locked', async () => {
    const { plumbing } = await seedCategories(app);
    const client = await loginAs(app, '+77072910001');
    const master = await createActiveMaster(app, '+77072910002', plumbing.id, pointAtKm(1));
    const order = await createOrderViaApi(app, client.token, plumbing.id);
    const prisma = app.get(PrismaService);
    let ready!: () => void;
    let failed!: (reason: unknown) => void;
    const acquired = new Promise<void>((resolve, reject) => { ready = resolve; failed = reject; });
    let release!: () => void;
    const released = new Promise<void>(resolve => { release = resolve; });
    const holder = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${master.userId} FOR UPDATE`;
      ready();
      await released;
    }, { maxWait: 5000, timeout: 10000 });
    // An acquisition failure must reject the barrier, not hang the test.
    void holder.catch(failed);
    let statusWhileLocked: string | undefined;
    let offersWhileLocked: number | undefined;
    try {
      await acquired;
      await app.get(MatchingService).handleWave({ orderId: order.id, wave: 1 });
      statusWhileLocked = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status;
      offersWhileLocked = await prisma.orderOffer.count({ where: { orderId: order.id } });
    } finally {
      release();
      await holder;
    }
    await app.get(SequentialMatchingService).recover();
    const recovered = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const offers = await prisma.orderOffer.findMany({ where: { orderId: order.id } });
    expect(offersWhileLocked).toBe(0);
    expect(statusWhileLocked).toBe('SEARCHING');
    expect(recovered.status).toBe('SEARCHING');
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ masterUserId: master.userId, outcome: 'PENDING', sequential: true });
    expect(offers[0].expiresAt!.getTime() - offers[0].sentAt.getTime()).toBeGreaterThan(29000);
    expect(offers[0].expiresAt!.getTime() - offers[0].sentAt.getTime()).toBeLessThanOrEqual(30000);
 }, 25000);

  it('still reaches NO_MASTERS when no eligible candidate exists, without fabricating an offer', async () => {
    const { plumbing } = await seedCategories(app);
    const client = await loginAs(app, '+77072910011');
    const order = await createOrderViaApi(app, client.token, plumbing.id);
    const prisma = app.get(PrismaService);
    await app.get(MatchingService).handleWave({ orderId: order.id, wave: 1 });
    await app.get(SequentialMatchingService).recover();
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('NO_MASTERS');
    expect(await prisma.orderOffer.count({ where: { orderId: order.id } })).toBe(0);
  });
});
