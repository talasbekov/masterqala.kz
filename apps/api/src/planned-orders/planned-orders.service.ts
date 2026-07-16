import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PlannedOrder, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PLANNED_HORIZON_DAYS, PLANNED_ORDER_INCLUDE } from './planned-order.constants';
import { CreatePlannedOrderDto } from './dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PlannedOrdersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly gateway: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    // Хендлеры джоб регистрируются по мере добавления в Task 7/8.
  }

  async create(clientId: string, dto: CreatePlannedOrderDto) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException('Неизвестная категория');

    const scheduledAt = new Date(dto.scheduledAt);
    const now = new Date();
    const horizon = new Date(now.getTime() + PLANNED_HORIZON_DAYS * 24 * 3600 * 1000);
    if (scheduledAt <= now) throw new BadRequestException('Дата должна быть в будущем');
    if (scheduledAt > horizon) {
      throw new BadRequestException(`Дата должна быть не позднее ${PLANNED_HORIZON_DAYS} дней вперёд`);
    }

    const order = await this.prisma.plannedOrder.create({
      data: {
        clientId,
        categoryId: dto.categoryId,
        description: dto.description,
        address: dto.address,
        district: dto.district,
        scheduledAt,
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
    const delaySeconds = Math.max(0, Math.floor((scheduledAt.getTime() - Date.now()) / 1000));
    await this.queue.send(JOBS.PLANNED_EXPIRY, { plannedOrderId: order.id }, delaySeconds);
    return this.findOrThrow(order.id);
  }

  async listMine(clientId: string) {
    return this.prisma.plannedOrder.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: PLANNED_ORDER_INCLUDE,
    });
  }

  async findOrThrow(id: string) {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id }, include: PLANNED_ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Заявка не найдена');
    return order;
  }

  /** Атомарный гейт перехода. count===0 → 409. */
  async gate(
    id: string,
    from: Prisma.Enumerable<PlannedOrder['status']>,
    data: Prisma.PlannedOrderUpdateManyMutationInput | Prisma.PlannedOrderUncheckedUpdateManyInput,
    tx: Tx = this.prisma,
  ): Promise<void> {
    const res = await tx.plannedOrder.updateMany({
      where: { id, status: Array.isArray(from) ? { in: from } : from },
      data,
    });
    if (res.count === 0) throw new ConflictException('Заявка в другом статусе');
  }

  /** Владелец заявки? Иначе 403. Используется переходами клиента. */
  async guardClient(clientId: string, id: string) {
    const order = await this.findOrThrow(id);
    if (order.clientId !== clientId) throw new ForbiddenException('Нет доступа к заявке');
    return order;
  }
}
