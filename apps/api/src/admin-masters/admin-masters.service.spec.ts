import { AdminMastersService } from './admin-masters.service';

describe('AdminMastersService', () => {
  function build() {
    const prisma = { masterProfile: { findMany: jest.fn() } } as any;
    const reviews = { attachRatingToAll: jest.fn((rows: any[]) => Promise.resolve(rows)) } as any;
    return { service: new AdminMastersService(prisma, reviews), prisma, reviews };
  }

  it('derives status priority: blocked > priority-penalized > online > offline', async () => {
    const { service, prisma } = build();
    const now = Date.now();
    prisma.masterProfile.findMany.mockResolvedValue([
      { id: 'p1', userId: 'u1', fullName: 'Блок', blockedUntil: new Date(now + 100000), priorityPenaltyUntil: null, categories: [], user: { id: 'u1', name: null, _count: { masterOrders: 0, masterPlannedOrders: 0 }, presence: { isOnline: true } } },
      { id: 'p2', userId: 'u2', fullName: 'Штраф', blockedUntil: null, priorityPenaltyUntil: new Date(now + 100000), categories: [], user: { id: 'u2', name: null, _count: { masterOrders: 0, masterPlannedOrders: 0 }, presence: { isOnline: true } } },
      { id: 'p3', userId: 'u3', fullName: 'Онлайн', blockedUntil: null, priorityPenaltyUntil: null, categories: [], user: { id: 'u3', name: null, _count: { masterOrders: 0, masterPlannedOrders: 0 }, presence: { isOnline: true } } },
      { id: 'p4', userId: 'u4', fullName: 'Офлайн', blockedUntil: null, priorityPenaltyUntil: null, categories: [], user: { id: 'u4', name: null, _count: { masterOrders: 0, masterPlannedOrders: 0 }, presence: { isOnline: false } } },
    ]);

    const rows = await service.list();

    expect(rows.map((r) => r.status)).toEqual([
      expect.stringContaining('блокирован до'),
      expect.stringContaining('приоритет ↓ до'),
      'активен · онлайн',
      'активен · офлайн',
    ]);
  });
});
