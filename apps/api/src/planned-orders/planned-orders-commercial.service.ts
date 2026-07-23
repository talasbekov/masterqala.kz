import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PlaceBidDto } from './dto';
import { PLANNED_MAX_BIDS } from './planned-order.constants';
import { PlannedOrdersService } from './planned-orders.service';

@Injectable()
export class PlannedOrdersCommercialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
    private readonly plannedOrders: PlannedOrdersService,
  ) {}

  async placeBid(masterUserId: string, plannedOrderId: string, dto: PlaceBidDto) {
    const storedOrder = await this.prisma.plannedOrder.findUnique({
      where: { id: plannedOrderId },
      select: { commercialMode: true },
    });
    if (!storedOrder) throw new NotFoundException('Заявка не найдена');
    if (storedOrder.commercialMode !== 'FREE_PILOT') {
      return this.plannedOrders.placeBid(masterUserId, plannedOrderId, dto);
    }

    let clientId = '';
    let bidsCount = 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.plannedOrder.findUnique({ where: { id: plannedOrderId } });
        if (!order) throw new NotFoundException('Заявка не найдена');
        if (order.status !== 'PUBLISHED') throw new ConflictException('Заявка уже не принимает ставки');
        clientId = order.clientId;

        const profile = await tx.masterProfile.findUnique({ where: { userId: masterUserId } });
        if (profile?.blockedUntil && profile.blockedUntil > new Date()) {
          throw new UnprocessableEntityException('Доступ к новым заявкам временно ограничен');
        }

        const existingBids = await tx.plannedOrderBid.count({ where: { plannedOrderId } });
        if (existingBids >= PLANNED_MAX_BIDS) {
          throw new UnprocessableEntityException('Достигнут лимит откликов на заявку');
        }

        await tx.plannedOrderBid.create({
          data: {
            plannedOrderId,
            masterUserId,
            price: dto.price,
            term: dto.term,
            comment: dto.comment ?? null,
          },
        });
        bidsCount = existingBids + 1;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Вы уже откликнулись на эту заявку');
      }
      throw e;
    }

    this.gateway.emitToUser(clientId, 'bid:new', { plannedOrderId, bidsCount });
    return this.prisma.plannedOrderBid.findFirstOrThrow({ where: { plannedOrderId, masterUserId } });
  }

  async cancel(user: User, plannedOrderId: string) {
    const order = await this.plannedOrders.findOrThrow(plannedOrderId);
    if (order.commercialMode !== 'FREE_PILOT') {
      return this.plannedOrders.cancel(user, plannedOrderId);
    }

    if (order.clientId !== user.id) {
      if (order.masterId === user.id) return this.plannedOrders.cancel(user, plannedOrderId);
      throw new ForbiddenException('Нет доступа к заявке');
    }

    const before = ['CREATED', 'PUBLISHED'] as const;
    const after = ['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'] as const;

    if ((before as readonly string[]).includes(order.status)) {
      await this.plannedOrders.gate(plannedOrderId, [...before], {
        status: 'CANCELLED_BY_CLIENT',
        cancelReason: 'Отменена клиентом',
      });
      await this.plannedOrders.emitPlannedStatus(plannedOrderId);
      return this.plannedOrders.findOrThrow(plannedOrderId);
    }

    if ((after as readonly string[]).includes(order.status)) {
      await this.plannedOrders.gate(plannedOrderId, [...after], {
        status: 'CANCELLED_BY_CLIENT',
        cancelReason: 'Отменена клиентом после выбора мастера',
      });
      await this.plannedOrders.emitPlannedStatus(plannedOrderId);
      return this.plannedOrders.findOrThrow(plannedOrderId);
    }

    throw new ConflictException('На этом этапе отмена недоступна');
  }
}
