import { ConflictException } from '@nestjs/common';
import { PlannedOrdersService } from './planned-orders.service';
import { PlannedOrdersCommercialService } from './planned-orders-commercial.service';
import { DisputesService } from '../disputes/disputes.service';
import { ReviewsService } from '../reviews/reviews.service';

function fixture(
  lifecycleModel = 'PLATFORM_V1_RESERVED',
  status = 'PUBLISHED',
) {
  const order: any = {
    id: 'planned-1',
    lifecycleModel,
    status,
    commercialMode: 'DIRECT_PAYMENT',
    clientId: 'client-1',
    masterId: 'master-1',
    selectedBidId: 'bid-1',
    selectedAt: new Date(),
    confirmedAt: null,
    completedAt: null,
    closedAt: new Date(),
    slotStart: new Date(),
    slotEnd: new Date(),
    workPrice: 1000,
    master: { id: 'master-1' },
    client: { id: 'client-1' },
    bids: [],
    photos: [],
    _count: { bids: 0 },
  };
  const prisma: any = {
    plannedOrder: {
      findUnique: jest.fn(async () => ({ ...order })),
      findUniqueOrThrow: jest.fn(async () => ({ ...order })),
      findMany: jest.fn(async () => [order]),
      updateMany: jest.fn(async ({ data }) => {
        Object.assign(order, data);
        return { count: 1 };
      }),
      create: jest.fn(async () => order),
    },
    plannedOrderBid: {
      findUnique: jest.fn(async () => ({
        id: 'bid-1',
        plannedOrderId: order.id,
        masterUserId: 'master-1',
        price: 1000,
      })),
      findUniqueOrThrow: jest.fn(async () => ({ price: 1000 })),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      create: jest.fn(async () => ({ id: 'bid-2' })),
      findFirstOrThrow: jest.fn(async () => ({ id: 'bid-2' })),
    },
    masterProfile: { findUnique: jest.fn(async () => null) },
    masterCategory: {
      findMany: jest.fn(async () => [{ categoryId: 'category-1' }]),
    },
    leadCreditAccount: {
      updateMany: jest.fn(async () => ({ count: 1 })),
      update: jest.fn(),
    },
    leadCreditTransaction: { create: jest.fn() },
    category: { findUnique: jest.fn(async () => ({ id: 'category-1' })) },
    dispute: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(),
      findUnique: jest.fn(async () => ({
        id: 'dispute-1',
        plannedOrderId: order.id,
        orderId: null,
        status: 'OPEN',
      })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    review: { create: jest.fn() },
    $queryRaw: jest.fn(async () => [{ id: order.id }]),
  };
  prisma.$transaction = async (fn: any) => fn(prisma);
  const queue: any = { send: jest.fn() },
    gateway: any = { emitToUser: jest.fn() };
  const penalties: any = {
    applyPenalty: jest.fn(),
    penalizeForCancellation: jest.fn(),
  };
  const disputes: any = { hasOpenDispute: jest.fn(async () => false) };
  const service = new PlannedOrdersService(
    prisma,
    queue,
    gateway,
    penalties,
    disputes,
    {} as any,
    { attachRating: async (value: any) => value } as any,
  );
  const commercial = new PlannedOrdersCommercialService(
    prisma,
    gateway,
    service,
  );
  const disputeService = new DisputesService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    penalties,
    {} as any,
    { write: jest.fn() } as any,
  );
  return {
    order,
    prisma,
    queue,
    gateway,
    penalties,
    service,
    commercial,
    disputeService,
  };
}

describe('Reserved planned generation stays outside legacy workflows', () => {
  it.each(['PLATFORM_V1_RESERVED', 'FUTURE_UNKNOWN', undefined, null])(
    'rejects nonlegacy %s bid before any credit or bid write',
    async (model) => {
      const f = fixture();
      f.order.lifecycleModel = model;
      await expect(
        f.commercial.placeBid('master-1', 'planned-1', {
          price: 1000,
          term: 'preliminary',
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        f.service.placeBid('master-1', 'planned-1', {
          price: 1000,
          term: 'preliminary',
        }),
      ).rejects.toThrow(ConflictException);
      expect(f.prisma.leadCreditAccount.updateMany).not.toHaveBeenCalled();
      expect(f.prisma.leadCreditTransaction.create).not.toHaveBeenCalled();
      expect(f.prisma.plannedOrderBid.create).not.toHaveBeenCalled();
      expect(f.gateway.emitToUser).not.toHaveBeenCalled();
    },
  );

  it.each(['FREE_PILOT', 'DIRECT_PAYMENT', 'PAID_MOCK'])(
    'rejects reserved %s even when an earlier commercial read was legacy',
    async (commercialMode) => {
      const f = fixture();
      f.order.commercialMode = commercialMode;
      f.prisma.plannedOrder.findUnique.mockResolvedValueOnce({
        ...f.order,
        lifecycleModel: 'LEGACY',
      });
      await expect(
        f.commercial.placeBid('master-1', 'planned-1', {
          price: 1000,
          term: 'Preliminary',
        }),
      ).rejects.toThrow(ConflictException);
      expect(f.prisma.plannedOrderBid.create).not.toHaveBeenCalled();
      expect(f.prisma.leadCreditAccount.updateMany).not.toHaveBeenCalled();
      expect(f.prisma.leadCreditTransaction.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    'select',
    'confirm',
    'decline',
    'onSite',
    'complete',
    'confirmCompletion',
    'cancel',
  ] as const)(
    'legacy %s cannot mutate the reserved lifecycle',
    async (method) => {
      const f = fixture(
        'PLATFORM_V1_RESERVED',
        method === 'complete'
          ? 'IN_PROGRESS'
          : method === 'confirmCompletion'
            ? 'DONE'
            : 'CONFIRMED',
      );
      const call =
        method === 'select'
          ? f.service.select('client-1', 'planned-1', { bidId: 'bid-1' })
          : method === 'cancel'
            ? f.commercial.cancel({ id: 'client-1' } as any, 'planned-1')
            : method === 'confirmCompletion'
              ? f.service.confirmCompletion('client-1', 'planned-1')
              : f.service[method]('master-1', 'planned-1');
      await expect(call).rejects.toThrow(ConflictException);
      expect(f.prisma.plannedOrder.updateMany).not.toHaveBeenCalled();
      expect(f.queue.send).not.toHaveBeenCalled();
      expect(f.penalties.penalizeForCancellation).not.toHaveBeenCalled();
    },
  );

  it.each([
    'handleAutoClose',
    'handleConfirmTimeout',
    'handlePlannedExpiry',
  ] as const)(
    'legacy worker %s ignores the reserved lifecycle',
    async (worker) => {
      const status =
        worker === 'handleAutoClose'
          ? 'DONE'
          : worker === 'handleConfirmTimeout'
            ? 'MASTER_SELECTED'
            : 'PUBLISHED';
      const f = fixture('PLATFORM_V1_RESERVED', status);
      await f.service[worker]({ plannedOrderId: 'planned-1', bidId: 'bid-1' });
      expect(f.order.status).toBe(status);
      expect(f.prisma.plannedOrder.updateMany).not.toHaveBeenCalled();
      expect(f.gateway.emitToUser).not.toHaveBeenCalled();
    },
  );

  it('transition CAS includes the exact legacy model even after an earlier read', async () => {
    const f = fixture('LEGACY', 'CONFIRMED');
    await f.service.gate('planned-1', 'CONFIRMED', { status: 'IN_PROGRESS' });
    expect(f.prisma.plannedOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'planned-1', lifecycleModel: 'LEGACY', status: 'CONFIRMED' },
      data: { status: 'IN_PROGRESS' },
    });
  });

  it('current create path explicitly creates LEGACY even with an injected reserved value', async () => {
    const f = fixture('LEGACY');
    await f.service.create('client-1', {
      categoryId: 'category-1',
      description: 'Task',
      address: 'Address',
      district: 'District',
      slotStart: new Date(Date.now() + 3600000).toISOString(),
      slotEnd: new Date(Date.now() + 7200000).toISOString(),
      lifecycleModel: 'PLATFORM_V1_RESERVED',
    } as any);
    expect(f.prisma.plannedOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lifecycleModel: 'LEGACY' }),
      }),
    );
  });

  it('legacy master arrival and automatic completion behavior remains available only to LEGACY', async () => {
    const f = fixture('LEGACY', 'CONFIRMED');
    await f.service.onSite('master-1', 'planned-1');
    expect(f.order.status).toBe('IN_PROGRESS');
    f.order.status = 'DONE';
    await f.service.handleAutoClose({ plannedOrderId: 'planned-1' });
    expect(f.order.status).toBe('CLOSED');
  });

  it('reserved rows cannot be opened/resolved by legacy disputes or reviewed as legacy completion', async () => {
    const f = fixture('PLATFORM_V1_RESERVED', 'DONE');
    await expect(
      f.disputeService.openForPlannedOrder(
        { id: 'client-1' } as any,
        'planned-1',
        { reason: 'Test' },
      ),
    ).rejects.toThrow(ConflictException);
    await expect(
      f.disputeService.resolve('operator-1', 'dispute-1', {
        refundServiceFee: false,
        penalizeMaster: true,
        resolutionNote: 'Test',
      }),
    ).rejects.toThrow(ConflictException);
    expect(f.prisma.dispute.create).not.toHaveBeenCalled();
    expect(f.prisma.dispute.updateMany).not.toHaveBeenCalled();
    expect(f.penalties.applyPenalty).not.toHaveBeenCalled();
    f.order.status = 'CLOSED';
    await expect(
      new ReviewsService(f.prisma).submitForPlannedOrder(
        'client-1',
        'planned-1',
        { rating: 5 },
      ),
    ).rejects.toThrow(ConflictException);
    expect(f.prisma.review.create).not.toHaveBeenCalled();
  });
});
