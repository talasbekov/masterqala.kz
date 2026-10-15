import { SequentialMatchingService } from './sequential-matching.service';

function fixture(eligible: boolean, expired = false) {
  const order = { id: 'order-1', clientId: 'client-1', categoryId: 'category-1', category: { name: 'Actual category' }, status: 'SEARCHING', dispatchMode: 'SEQUENTIAL', searchAttempt: 1 };
  const pending = expired ? { id: 'expired-1', masterUserId: 'old-master', expiresAt: new Date(0) } : null;
  const tx = {
    $queryRaw: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce(eligible ? [{ id: 'eligible-master', meters: 1000 }] : []),
    order: { findUnique: jest.fn().mockResolvedValue(order), update: jest.fn() },
    orderOffer: { findFirst: jest.fn().mockResolvedValue(pending), update: jest.fn(), create: jest.fn() },
  };
  const gateway = { emitToUser: jest.fn() }, queue = { send: jest.fn() };
  const prisma = { $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) };
  const service = new SequentialMatchingService(prisma as never, queue as never, gateway as never);
  return { service, tx, gateway, queue };
}

describe('Sequential deferred candidate event/expiry contract', () => {
  it('does not emit terminal NO_MASTERS or create an offer when eligibility remains behind a skipped lock', async () => {
    const { service, tx, gateway, queue } = fixture(true);
    await service.dispatch('order-1', 1);
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(tx.orderOffer.create).not.toHaveBeenCalled();
    expect(queue.send).not.toHaveBeenCalled();
    expect(gateway.emitToUser).toHaveBeenCalledWith('client-1', 'order:status', { orderId: 'order-1', status: 'SEARCHING' });
    const selection = tx.$queryRaw.mock.calls[1][0], eligibility = tx.$queryRaw.mock.calls[2][0];
    expect(selection.sql).toMatch(/FOR UPDATE OF u SKIP LOCKED\s*$/);
    expect(eligibility.sql).not.toMatch(/FOR UPDATE/);
    expect(selection.sql.replace(/\s*FOR UPDATE OF u SKIP LOCKED\s*$/, '')).toBe(eligibility.sql.trimEnd());
    expect(selection.values).toEqual(eligibility.values);
    expect(selection.sql).toContain(`busy."lifecycleModel"='LEGACY'`);
  });

  it('still closes an expired offer while deferring a temporarily locked next candidate', async () => {
    const { service, tx, gateway } = fixture(true, true);
    await service.dispatch('order-1', 1);
    expect(tx.orderOffer.update).toHaveBeenCalledWith({ where: { id: 'expired-1' }, data: { outcome: 'EXPIRED', respondedAt: expect.any(Date) } });
    expect(gateway.emitToUser).toHaveBeenCalledWith('old-master', 'offer:closed', expect.objectContaining({ orderId: 'order-1', offerId: 'expired-1' }));
    expect(tx.order.update).not.toHaveBeenCalled();
    expect(gateway.emitToUser).not.toHaveBeenCalledWith('client-1', 'order:status', { orderId: 'order-1', status: 'NO_MASTERS' });
  });

  it('keeps real exhaustion terminal when the identical nonlocking eligibility check is empty', async () => {
    const { service, tx, gateway } = fixture(false);
    await service.dispatch('order-1', 1);
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'order-1' }, data: { status: 'NO_MASTERS' } });
    expect(gateway.emitToUser).toHaveBeenCalledWith('client-1', 'order:status', { orderId: 'order-1', status: 'NO_MASTERS' });
  });
});
