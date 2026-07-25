import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(search?: string) {
    const users = await this.prisma.user.findMany({
      where: search
        ? { OR: [{ phone: { contains: search } }, { name: { contains: search, mode: 'insensitive' } }] }
        : {},
      orderBy: { createdAt: 'desc' },
      include: {
        masterProfile: { select: { id: true } },
        _count: { select: { clientOrders: true, masterOrders: true } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.masterProfile ? 'клиент + мастер' : 'клиент',
      orders: u._count.clientOrders + u._count.masterOrders,
      isBlocked: u.isBlocked,
    }));
  }

  async block(operatorId: string, userId: string, reason: string) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('Пользователь не найден');
    await this.prisma.user.update({
      where: { id: userId },
      data: { isBlocked: true, blockedAt: new Date(), blockedReason: reason },
    });
    await this.auditLog.write({
      actorType: 'OPERATOR',
      actorId: operatorId,
      action: 'USER_BLOCKED',
      targetType: 'USER',
      targetId: userId,
      comment: reason,
    });
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  async unblock(operatorId: string, userId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('Пользователь не найден');
    await this.prisma.user.update({
      where: { id: userId },
      data: { isBlocked: false, blockedAt: null, blockedReason: null },
    });
    await this.auditLog.write({
      actorType: 'OPERATOR',
      actorId: operatorId,
      action: 'USER_UNBLOCKED',
      targetType: 'USER',
      targetId: userId,
    });
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }
}
