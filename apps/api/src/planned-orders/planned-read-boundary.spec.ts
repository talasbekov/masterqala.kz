import { AdminMetricsService } from '../admin-metrics/admin-metrics.service';
import { MastersService } from '../masters/masters.service';
import { OrdersService } from '../orders/orders.service';
import { PlannedOrdersService } from './planned-orders.service';

describe('reserved planned records do not enter legacy counters and matching', () => {
  it('filters planned dashboard counts and disputes to the same visible legacy scope', async () => {
    const prisma: any = {
      order: { count: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      plannedOrder: { count: jest.fn() },
      dispute: { count: jest.fn() },
      masterProfile: { count: jest.fn() },
      withdrawalRequest: { count: jest.fn() },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ accepted: 0n, noMasters: 0n }])
        .mockResolvedValueOnce([{ median: null }]),
    };
    await new AdminMetricsService(prisma).getDashboard();
    expect(prisma.plannedOrder.count).toHaveBeenCalledWith({
      where: { lifecycleModel: 'LEGACY', status: 'PUBLISHED' },
    });
    expect(prisma.dispute.count).toHaveBeenCalledWith({
      where: {
        status: 'OPEN',
        OR: [
          { plannedOrderId: null },
          { plannedOrder: { lifecycleModel: 'LEGACY' } },
        ],
      },
    });
  });

  it('master stats and bid enrichment count only legacy planned completions', async () => {
    const count = jest.fn().mockResolvedValue(2);
    const prisma: any = {
      order: { count: jest.fn().mockResolvedValue(1) },
      plannedOrder: { count },
      accrual: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 123 } }),
      },
    };
    const reviews = {
      getMasterRatingSummary: jest
        .fn()
        .mockResolvedValue({ rating: 4, reviewCount: 1 }),
    };
    const stats = await MastersService.prototype.getMyStats.call(
      { prisma, reviews } as any,
      'master-1',
    );
    expect(stats.completedCount).toBe(3);
    expect(count).toHaveBeenLastCalledWith({
      where: {
        masterId: 'master-1',
        lifecycleModel: 'LEGACY',
        status: 'CLOSED',
      },
    });
    const bids = await (PlannedOrdersService.prototype as any).enrichBids.call(
      { prisma, reviews },
      [
        {
          masterUserId: 'master-2',
          master: { id: 'master-2', name: 'Master', masterProfile: null },
        },
      ],
    );
    expect(bids[0].master.completedCount).toBe(3);
    expect(count).toHaveBeenLastCalledWith({
      where: {
        masterId: 'master-2',
        lifecycleModel: 'LEGACY',
        status: 'CLOSED',
      },
    });
  });

  it('urgent acceptance scopes its planned busy check to the supported legacy model', async () => {
    const stop = new Error('stop at inspected busy query');
    const tx: any = {
      $queryRaw: jest.fn(),
      order: {
        findUnique: jest.fn().mockResolvedValue({ status: 'SEARCHING' }),
        count: jest.fn().mockResolvedValue(0),
      },
      plannedOrder: { count: jest.fn().mockRejectedValue(stop) },
    };
    const prisma = { $transaction: (fn: any) => fn(tx) };
    await expect(
      OrdersService.prototype.accept.call(
        { prisma } as any,
        'master-1',
        'order-1',
      ),
    ).rejects.toBe(stop);
    expect(tx.plannedOrder.count).toHaveBeenCalledWith({
      where: {
        masterId: 'master-1',
        lifecycleModel: 'LEGACY',
        status: 'IN_PROGRESS',
      },
    });
  });
});
