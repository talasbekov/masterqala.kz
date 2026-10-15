import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp,
  resetDb,
  seedCategories,
  loginAs,
  createActiveMaster,
} from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { PlannedOrdersService } from '../src/planned-orders/planned-orders.service';

describe('Planned generation boundary (isolated database)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(async () => {
    await resetDb(app);
  });

  async function seed() {
    const { plumbing } = await seedCategories(app);
    const client = await loginAs(app, '+77129991001');
    const master = await createActiveMaster(app, '+77129991002', plumbing.id);
    const operator = await loginAs(app, '+77129991003', 'OPERATOR');
    const data = {
      categoryId: plumbing.id,
      clientId: client.userId,
      masterId: master.userId,
      description: 'Existing task',
      address: 'Test address',
      district: 'Test district',
      slotStart: new Date(Date.now() + 3600000),
      slotEnd: new Date(Date.now() + 7200000),
    };
    return { client, master, operator, data };
  }

  it('database default and current API creation remain LEGACY with saved commercial modes intact', async () => {
    const { client, data } = await seed();
    for (const commercialMode of [
      'DIRECT_PAYMENT',
      'FREE_PILOT',
      'PAID_MOCK',
    ] as const) {
      const row = await prisma.plannedOrder.create({
        data: { ...data, commercialMode },
      });
      expect(row.lifecycleModel).toBe('LEGACY');
      expect(row.commercialMode).toBe(commercialMode);
    }
    const res = await request(app.getHttpServer())
      .post('/api/v1/planned-orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        ...data,
        slotStart: data.slotStart.toISOString(),
        slotEnd: data.slotEnd.toISOString(),
        lifecycleModel: 'PLATFORM_V1_RESERVED',
      })
      .expect(201);
    expect(res.body.lifecycleModel).toBe('LEGACY');
    expect(
      await prisma.plannedOrder.count({
        where: { lifecycleModel: 'PLATFORM_V1_RESERVED' },
      }),
    ).toBe(0);
  });

  it('reserved fixtures cannot spend credits, start, auto-close, expire, or resolve via old handlers', async () => {
    const { client, master, operator, data } = await seed();
    const row = await prisma.plannedOrder.create({
      data: {
        ...data,
        lifecycleModel: 'PLATFORM_V1_RESERVED',
        commercialMode: 'DIRECT_PAYMENT',
        status: 'PUBLISHED',
      },
    });
    await prisma.leadCreditAccount.create({
      data: { masterUserId: master.userId, balance: 2 },
    });
    const bid = await prisma.plannedOrderBid.create({
      data: {
        plannedOrderId: row.id,
        masterUserId: master.userId,
        price: 1000,
        term: 'Preliminary',
      },
    });
    const post = (token: string, path: string, body: object = {}) =>
      request(app.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    await post(master.token, `/api/v1/planned-orders/${row.id}/bids`, {
      price: 1000,
      term: 'Preliminary',
    }).expect(409);
    await post(client.token, `/api/v1/planned-orders/${row.id}/select`, {
      bidId: bid.id,
    }).expect(409);
    await prisma.plannedOrder.update({
      where: { id: row.id },
      data: { status: 'CONFIRMED', selectedBidId: bid.id },
    });
    await post(master.token, `/api/v1/planned-orders/${row.id}/on-site`).expect(
      409,
    );
    await post(master.token, `/api/v1/planned-orders/${row.id}/cancel`).expect(
      409,
    );
    await prisma.plannedOrder.update({
      where: { id: row.id },
      data: { status: 'DONE' },
    });
    await post(
      client.token,
      `/api/v1/planned-orders/${row.id}/confirm-completion`,
    ).expect(409);
    await app
      .get(PlannedOrdersService)
      .handleAutoClose({ plannedOrderId: row.id });
    expect(
      (await prisma.plannedOrder.findUniqueOrThrow({ where: { id: row.id } }))
        .status,
    ).toBe('DONE');
    const dispute = await prisma.dispute.create({
      data: {
        plannedOrderId: row.id,
        openedByUserId: client.userId,
        openedByRole: 'CLIENT',
        reason: 'Test reserved boundary',
      },
    });
    await post(operator.token, `/api/v1/admin/disputes/${dispute.id}/resolve`, {
      refundServiceFee: false,
      penalizeMaster: true,
      resolutionNote: 'Not permitted',
    }).expect(409);
    expect(
      (await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } }))
        .status,
    ).toBe('OPEN');
    expect(
      await prisma.auditLog.count({ where: { targetId: dispute.id } }),
    ).toBe(0);
    await prisma.plannedOrder.update({
      where: { id: row.id },
      data: { status: 'MASTER_SELECTED' },
    });
    await app
      .get(PlannedOrdersService)
      .handleConfirmTimeout({ plannedOrderId: row.id, bidId: bid.id });
    expect(
      (await prisma.plannedOrder.findUniqueOrThrow({ where: { id: row.id } }))
        .status,
    ).toBe('MASTER_SELECTED');
    // Removing test fixture bid makes the old expiry predicate otherwise eligible.
    await prisma.plannedOrder.update({
      where: { id: row.id },
      data: { status: 'PUBLISHED', selectedBidId: null },
    });
    await prisma.plannedOrderBid.delete({ where: { id: bid.id } });
    await app
      .get(PlannedOrdersService)
      .handlePlannedExpiry({ plannedOrderId: row.id });
    expect(
      (await prisma.plannedOrder.findUniqueOrThrow({ where: { id: row.id } }))
        .status,
    ).toBe('PUBLISHED');
    expect(
      (
        await prisma.leadCreditAccount.findUniqueOrThrow({
          where: { masterUserId: master.userId },
        })
      ).balance,
    ).toBe(2);
    expect(await prisma.leadCreditTransaction.count()).toBe(0);
    expect(await prisma.masterCancellation.count()).toBe(0);
    const mine = await request(app.getHttpServer())
      .get('/api/v1/planned-orders/mine')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    const feed = await request(app.getHttpServer())
      .get('/api/v1/planned-orders/feed')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(mine.body).toEqual([]);
    expect(feed.body).toEqual([]);
  });
});
