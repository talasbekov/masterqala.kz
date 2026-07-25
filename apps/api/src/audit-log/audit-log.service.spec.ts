import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('writes an audit entry using the provided transaction client', async () => {
    const create = jest.fn().mockResolvedValue({});
    const tx = { auditLog: { create } } as any;
    const service = new AuditLogService({} as any);

    await service.write(
      { actorType: 'OPERATOR', actorId: 'op-1', action: 'USER_BLOCKED', targetType: 'USER', targetId: 'u-1', comment: 'spam' },
      tx,
    );

    expect(create).toHaveBeenCalledWith({
      data: { actorType: 'OPERATOR', actorId: 'op-1', action: 'USER_BLOCKED', targetType: 'USER', targetId: 'u-1', comment: 'spam' },
    });
  });

  it('defaults to the injected PrismaService when no transaction client is given', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { auditLog: { create } } as any;
    const service = new AuditLogService(prisma);

    await service.write({ actorType: 'SYSTEM', action: 'AUTO_CLOSED', targetType: 'ORDER', targetId: 'o-1' });

    expect(create).toHaveBeenCalledWith({
      data: { actorType: 'SYSTEM', action: 'AUTO_CLOSED', targetType: 'ORDER', targetId: 'o-1' },
    });
  });

  it('paginates journal entries newest-first', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'a' }]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = { auditLog: { findMany, count }, $transaction: (ops: Promise<any>[]) => Promise.all(ops) } as any;
    const service = new AuditLogService(prisma);

    const result = await service.list(2, 10);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: { createdAt: 'desc' } }));
    expect(result).toEqual({ rows: [{ id: 'a' }], total: 1, page: 2, pageSize: 10 });
  });
});
