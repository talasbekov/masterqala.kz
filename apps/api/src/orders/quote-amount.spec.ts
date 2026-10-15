import { storedQuoteTotal, versionedQuoteTotal } from './quote-amount';
import { AdminOrdersService } from '../admin-orders/admin-orders.service';

const base = {
  id: 'order-1',
  lifecycleVersion: 2,
  quoteVersion: 1,
  workPrice: 8000,
  materialsPrice: 3500,
  calloutPrice: 2500,
  createdAt: new Date(),
  disputes: [],
  status: 'PRICE_APPROVED',
  client: { name: 'Client', phone: 'test' },
  category: { name: 'Test' },
};

describe('Stored quote total across public and operator readers', () => {
  it.each(['workPrice', 'materialsPrice', 'calloutPrice'])(
    'preserves unavailable %s in operator output',
    async (field) => {
      for (const value of [null, undefined, NaN, Infinity, -1, 0.5]) {
        const order = { ...base, [field]: value };
        expect(storedQuoteTotal(order)).toBeNull();
        expect(versionedQuoteTotal(order)).toBeNull();
        const service = new AdminOrdersService({
          order: { findUnique: async () => order },
        } as any);
        const result = await service.detail('order-1', 'urgent');
        expect(result.type).toBe('urgent');
        expect(
          'quoteTotal' in result ? result.quoteTotal : undefined,
        ).toBeNull();
      }
    },
  );
  it('preserves actual zero, rejects overflow and requires a positive integer quote version', () => {
    expect(
      storedQuoteTotal({ workPrice: 0, materialsPrice: 0, calloutPrice: 0 }),
    ).toBe(0);
    expect(storedQuoteTotal({ ...base, workPrice: 2147483647 })).toBeNull();
    for (const quoteVersion of [0, null, undefined, NaN, Infinity, -1, 1.5])
      expect(versionedQuoteTotal({ ...base, quoteVersion })).toBeNull();
    expect(versionedQuoteTotal(base)).toBe(14000);
  });
});
