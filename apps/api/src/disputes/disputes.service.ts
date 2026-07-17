import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OpenDisputeDto } from './dto';

const DISPUTE_WINDOW_AFTER_CLOSE_MS = 48 * 3600 * 1000;

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async openForOrder(user: User, orderId: string, dto: OpenDisputeDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const role = this.resolveRole(user, order.clientId, order.masterId);
    this.assertWithinWindow(order.status, order.closedAt);
    return this.create(user.id, role, dto.reason, { orderId });
  }

  async openForPlannedOrder(user: User, plannedOrderId: string, dto: OpenDisputeDto) {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const role = this.resolveRole(user, order.clientId, order.masterId);
    this.assertWithinWindow(order.status, order.closedAt);
    return this.create(user.id, role, dto.reason, { plannedOrderId });
  }

  private resolveRole(user: User, clientId: string, masterId: string | null): 'CLIENT' | 'MASTER' {
    if (user.id === clientId) return 'CLIENT';
    if (user.id === masterId) return 'MASTER';
    throw new ForbiddenException('Нет доступа к заявке');
  }

  private assertWithinWindow(status: string, closedAt: Date | null): void {
    const allowed = ['DONE', 'IN_PROGRESS', 'CLOSED'];
    if (!allowed.includes(status)) {
      throw new ConflictException('Спор недоступен на этом этапе заявки');
    }
    if (status === 'CLOSED') {
      if (!closedAt || Date.now() - closedAt.getTime() > DISPUTE_WINDOW_AFTER_CLOSE_MS) {
        throw new ConflictException('Окно открытия спора истекло');
      }
    }
  }

  private async create(
    userId: string,
    role: 'CLIENT' | 'MASTER',
    reason: string,
    target: { orderId: string } | { plannedOrderId: string },
  ) {
    try {
      return await this.prisma.dispute.create({
        data: { openedByUserId: userId, openedByRole: role, reason, ...target },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('По заявке уже открыт спор');
      }
      throw e;
    }
  }

  async hasOpenDispute(target: { orderId?: string; plannedOrderId?: string }): Promise<boolean> {
    const count = await this.prisma.dispute.count({ where: { ...target, status: 'OPEN' } });
    return count > 0;
  }
}
