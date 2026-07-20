import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitReviewDto } from './dto';

export interface MasterRatingSummary {
  rating: number | null;
  reviewCount: number;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async submitForOrder(clientId: string, orderId: string, dto: SubmitReviewDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.clientId !== clientId) throw new ForbiddenException('Нет доступа к заявке');
    if (order.status !== 'CLOSED') throw new ConflictException('Отзыв можно оставить только после закрытия заявки');
    return this.create({ orderId, clientId, masterUserId: order.masterId!, ...dto });
  }

  async submitForPlannedOrder(clientId: string, plannedOrderId: string, dto: SubmitReviewDto) {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId } });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (order.clientId !== clientId) throw new ForbiddenException('Нет доступа к заявке');
    if (order.status !== 'CLOSED') throw new ConflictException('Отзыв можно оставить только после закрытия заявки');
    return this.create({ plannedOrderId, clientId, masterUserId: order.masterId!, ...dto });
  }

  private async create(data: {
    orderId?: string;
    plannedOrderId?: string;
    clientId: string;
    masterUserId: string;
    rating: number;
    comment?: string;
  }) {
    try {
      return await this.prisma.review.create({
        data: {
          orderId: data.orderId,
          plannedOrderId: data.plannedOrderId,
          clientId: data.clientId,
          masterUserId: data.masterUserId,
          rating: data.rating,
          comment: data.comment ?? null,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Отзыв уже оставлен');
      }
      throw e;
    }
  }

  async getMasterRatingSummary(masterUserId: string): Promise<MasterRatingSummary> {
    const agg = await this.prisma.review.aggregate({
      where: { masterUserId },
      _avg: { rating: true },
      _count: true,
    });
    return { rating: agg._avg.rating, reviewCount: agg._count };
  }

  /** Домешивает rating/reviewCount в объект master {id,...}, если он есть. */
  async attachRating<T extends { master: { id: string } | null }>(entity: T): Promise<T> {
    if (!entity.master) return entity;
    const summary = await this.getMasterRatingSummary(entity.master.id);
    return { ...entity, master: { ...entity.master, ...summary } };
  }

  async attachRatingToAll<T extends { master: { id: string } | null }>(entities: T[]): Promise<T[]> {
    return Promise.all(entities.map((e) => this.attachRating(e)));
  }
}
