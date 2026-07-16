import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PlannedOrder, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  FEED_SELECT,
  PLANNED_CONFIRM_TIMEOUT_S,
  PLANNED_HORIZON_DAYS,
  PLANNED_MAX_BIDS,
  PLANNED_ORDER_INCLUDE,
} from './planned-order.constants';
import { CreatePlannedOrderDto, PlaceBidDto, SelectBidDto } from './dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PlannedOrdersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly gateway: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.PLANNED_CONFIRM_TIMEOUT, (d: { plannedOrderId: string; bidId: string }) =>
      this.handleConfirmTimeout(d),
    );
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

  async feed(masterUserId: string) {
    const categories = await this.prisma.masterCategory.findMany({
      where: { masterProfile: { userId: masterUserId } },
      select: { categoryId: true },
    });
    const categoryIds = categories.map((c) => c.categoryId);
    if (categoryIds.length === 0) return [];
    return this.prisma.plannedOrder.findMany({
      where: { status: 'PUBLISHED', categoryId: { in: categoryIds } },
      orderBy: { scheduledAt: 'asc' },
      select: FEED_SELECT,
    });
  }

  async placeBid(masterUserId: string, plannedOrderId: string, dto: PlaceBidDto) {
    let clientId = '';
    let bidsCount = 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.plannedOrder.findUnique({ where: { id: plannedOrderId } });
        if (!order) throw new NotFoundException('Заявка не найдена');
        if (order.status !== 'PUBLISHED') throw new ConflictException('Заявка уже не принимает ставки');
        clientId = order.clientId;

        const existingBids = await tx.plannedOrderBid.count({ where: { plannedOrderId } });
        if (existingBids >= PLANNED_MAX_BIDS) {
          throw new UnprocessableEntityException('Достигнут лимит откликов на заявку');
        }

        const spent = await tx.leadCreditAccount.updateMany({
          where: { masterUserId, balance: { gte: 1 } },
          data: { balance: { decrement: 1 } },
        });
        if (spent.count === 0) throw new UnprocessableEntityException('Недостаточно lead-кредитов');

        const created = await tx.plannedOrderBid.create({
          data: { plannedOrderId, masterUserId, price: dto.price, term: dto.term, comment: dto.comment ?? null },
        });
        await tx.leadCreditTransaction.create({
          data: { masterUserId, type: 'SPEND', amount: 1, bidId: created.id },
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

  async select(clientId: string, plannedOrderId: string, dto: SelectBidDto) {
    const order = await this.guardClient(clientId, plannedOrderId);
    const bid = await this.prisma.plannedOrderBid.findUnique({ where: { id: dto.bidId } });
    if (!bid || bid.plannedOrderId !== plannedOrderId) throw new BadRequestException('Ставка не найдена');
    void order;

    await this.gate(plannedOrderId, 'PUBLISHED', {
      status: 'MASTER_SELECTED',
      masterId: bid.masterUserId,
      selectedBidId: bid.id,
      selectedAt: new Date(),
    });
    await this.queue.send(JOBS.PLANNED_CONFIRM_TIMEOUT, { plannedOrderId, bidId: bid.id }, PLANNED_CONFIRM_TIMEOUT_S);

    const others = await this.prisma.plannedOrderBid.findMany({
      where: { plannedOrderId, masterUserId: { not: bid.masterUserId } },
    });
    this.gateway.emitToUser(bid.masterUserId, 'bid:selected', { plannedOrderId });
    for (const o of others) {
      this.gateway.emitToUser(o.masterUserId, 'bid:closed', { plannedOrderId, reason: 'Выбран другой мастер' });
    }
    await this.emitPlannedStatus(plannedOrderId);
    const fresh = await this.findOrThrow(plannedOrderId);
    return this.redactMasterContact(fresh);
  }

  async confirm(masterUserId: string, plannedOrderId: string) {
    const order = await this.findOrThrow(plannedOrderId);
    if (order.masterId !== masterUserId) throw new ForbiddenException('Нет доступа к заявке');
    if (!order.selectedBidId) throw new ConflictException('Ставка не выбрана');
    const bid = await this.prisma.plannedOrderBid.findUniqueOrThrow({ where: { id: order.selectedBidId } });
    await this.gate(plannedOrderId, 'MASTER_SELECTED', {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      workPrice: bid.price,
    });
    await this.emitPlannedStatus(plannedOrderId);
    return this.findOrThrow(plannedOrderId);
  }

  async decline(masterUserId: string, plannedOrderId: string) {
    const order = await this.findOrThrow(plannedOrderId);
    if (order.masterId !== masterUserId) throw new ForbiddenException('Нет доступа к заявке');
    await this.returnToPublished(plannedOrderId);
    return this.findOrThrow(plannedOrderId);
  }

  /** Джоба: мастер молчал 2 часа. bidId сверяется — устаревший вызов (после re-select) игнорируется. */
  async handleConfirmTimeout({ plannedOrderId, bidId }: { plannedOrderId: string; bidId: string }): Promise<void> {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId } });
    if (!order || order.status !== 'MASTER_SELECTED' || order.selectedBidId !== bidId) return;
    await this.returnToPublished(plannedOrderId);
  }

  private async returnToPublished(plannedOrderId: string): Promise<void> {
    await this.gate(plannedOrderId, 'MASTER_SELECTED', {
      status: 'PUBLISHED',
      masterId: null,
      selectedBidId: null,
      selectedAt: null,
    });
    await this.emitPlannedStatus(plannedOrderId);
  }

  async emitPlannedStatus(plannedOrderId: string): Promise<void> {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId }, include: PLANNED_ORDER_INCLUDE });
    if (!order) return;
    const base = {
      plannedOrderId: order.id,
      status: order.status,
      workPrice: order.workPrice,
      cancelReason: order.cancelReason,
      scheduledAt: order.scheduledAt,
    };
    this.gateway.emitToUser(order.clientId, 'planned:status', { ...base, master: this.redactMasterContact(order).master });
    if (order.masterId) this.gateway.emitToUser(order.masterId, 'planned:status', { ...base, master: order.master });
  }

  async getByIdForUser(user: User, id: string) {
    const order = await this.findOrThrow(id);
    if (order.clientId === user.id) return this.redactMasterContact(order);
    const revealed = order.masterId === user.id;
    return revealed ? order : { ...order, address: null, client: null };
  }

  private static readonly MASTER_CONTACT_REVEALED_STATUSES: PlannedOrder['status'][] = [
    'CONFIRMED',
    'IN_PROGRESS',
    'DONE',
    'CLOSED',
  ];

  /** Клиенту телефон мастера виден только с CONFIRMED — §3.4 шаг 7. */
  private redactMasterContact<T extends { status: PlannedOrder['status']; master: { id: string; name: string | null; phone: string } | null }>(
    order: T,
  ): T {
    if (order.master && !PlannedOrdersService.MASTER_CONTACT_REVEALED_STATUSES.includes(order.status)) {
      return { ...order, master: { ...order.master, phone: '' } };
    }
    return order;
  }
}
