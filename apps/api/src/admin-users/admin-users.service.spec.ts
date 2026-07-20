import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  function build() {
    const prisma = {
      user: { findMany: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
    } as any;
    const auditLog = { write: jest.fn() } as any;
    return { service: new AdminUsersService(prisma, auditLog), prisma, auditLog };
  }

  it('blocks a user and writes an audit entry', async () => {
    const { service, prisma, auditLog } = build();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u-1', isBlocked: true });

    await service.block('op-1', 'u-1', 'жалобы мастеров');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: expect.objectContaining({ isBlocked: true, blockedReason: 'жалобы мастеров' }),
    });
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'OPERATOR',
        actorId: 'op-1',
        action: 'USER_BLOCKED',
        targetType: 'USER',
        targetId: 'u-1',
        comment: 'жалобы мастеров',
      }),
    );
  });

  it('unblocks a user and clears the reason', async () => {
    const { service, prisma, auditLog } = build();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'u-1', isBlocked: false });

    await service.unblock('op-1', 'u-1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { isBlocked: false, blockedAt: null, blockedReason: null },
    });
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_UNBLOCKED', targetId: 'u-1' }),
    );
  });
});
