import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Order, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '../payments/payment.interface';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  ACTIVE_CLIENT_STATUSES,
  ACTIVE_MASTER_STATUSES,
  AUTO_CLOSE_S,
  ORDER_INCLUDE,
  PRICE_CONFIRM_TIMEOUT_S,
} from './order.constants';
import { CreateOrderDto, PreviewOrderDto, ProposePriceDto } from './dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly queue: QueueService,
    private readonly gateway: RealtimeGateway,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
  ) {}

  async preview(dto: PreviewOrderDto) {
    const quote = await this.pricing.quote(dto.categoryId, {
      lat: dto.lat,
      lng: dto.lng,
    });
    return quote ? { available: true, ...quote } : { available: false };
  }

  async create(clientId: string, dto: CreateOrderDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new BadRequestException('Неизвестная категория');

    const active = await this.prisma.order.count({
      where: { clientId, status: { in: ACTIVE_CLIENT_STATUSES } },
    });
    if (active > 0)
      throw new ConflictException('У вас уже есть активная заявка');

    const quote = await this.pricing.quote(dto.categoryId, {
      lat: dto.lat,
      lng: dto.lng,
    });
    if (!quote) throw new UnprocessableEntityException('Мастеров рядом нет');

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          clientId,
          categoryId: dto.categoryId,
          description: dto.description,
          address: dto.address,
          calloutPrice: quote.calloutPrice,
          serviceFee: quote.serviceFee,
        },
      });
      await tx.$executeRaw`
        UPDATE "Order"
        SET location = ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography
        WHERE id = ${created.id}`;
      return created;
    });

    // Ошибка холда → заявка остаётся CREATED и не публикуется (§3.3).
    await this.payments.hold(order.id, order.serviceFee);
    await this.gate(order.id, 'CREATED', { status: 'SEARCHING' });
    await this.queue.send(JOBS.WAVE, { orderId: order.id, wave: 1 });
    return this.findOrThrow(order.id);
  }

  async getActive(clientId: string) {
    const order = await this.prisma.order.findFirst({
      where: { clientId, status: { in: ACTIVE_CLIENT_STATUSES } },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return { order };
  }

  async listMine(clientId: string) {
    return this.prisma.order.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
  }

  async getMasterActive(masterUserId: string) {
    const order = await this.prisma.order.findFirst({
      where: { masterId: masterUserId, status: { in: ACTIVE_MASTER_STATUSES } },
      include: ORDER_INCLUDE,
    });
    return { order };
  }

  async getById(user: User, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    if (
      order.clientId !== user.id &&
      order.masterId !== user.id &&
      user.role !== 'OPERATOR'
    ) {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    return order;
  }

  async findOrThrow(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    return order;
  }

  /** Атомарный гейт перехода. count===0 → 409. */
  async gate(
    orderId: string,
    from: Prisma.Enumerable<Order['status']>,
    data: Prisma.OrderUpdateManyMutationInput,
    tx: Tx = this.prisma,
  ): Promise<void> {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: Array.isArray(from) ? { in: from } : from },
      data,
    });
    if (res.count === 0) throw new ConflictException('Заявка в другом статусе');
  }

  /** Начисление компенсации мастеру; идемпотентно за счёт unique(orderId). */
  async accrueCompensation(tx: Tx, order: Order): Promise<void> {
    if (!order.masterId) return;
    await tx.accrual.createMany({
      data: [
        {
          masterUserId: order.masterId,
          orderId: order.id,
          type: 'CALLOUT_COMPENSATION',
          amount: order.calloutPrice - order.serviceFee,
        },
      ],
      skipDuplicates: true,
    });
  }

  /** WS `order:status` обеим сторонам заявки. */
  async emitOrderStatus(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    if (!order) return;
    const payload = {
      orderId: order.id,
      status: order.status,
      wave: order.wave,
      master: order.master,
      workPrice: order.workPrice,
      workComment: order.workComment,
      cancelReason: order.cancelReason,
      calloutPrice: order.calloutPrice,
      priceProposedAt: order.priceProposedAt,
    };
    this.gateway.emitToUser(order.clientId, 'order:status', payload);
    if (order.masterId)
      this.gateway.emitToUser(order.masterId, 'order:status', payload);
  }

  /** Гонка «Принять»: гейт SEARCHING→ACCEPTED атомарен; проигравший получает 409. */
  async accept(masterUserId: string, orderId: string): Promise<Order> {
    const losers = await this.prisma.$transaction(async (tx) => {
      const busy = await tx.order.count({
        where: { masterId: masterUserId, status: { in: ACTIVE_MASTER_STATUSES } },
      });
      if (busy > 0) throw new ConflictException('У вас уже есть активная заявка');

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Заявка не найдена');

      const offer = await tx.orderOffer.findFirst({
        where: { orderId, masterUserId, attempt: order.searchAttempt, outcome: 'PENDING' },
      });
      if (!offer) throw new ForbiddenException('Предложение недоступно');

      const gate = await tx.order.updateMany({
        where: { id: orderId, status: 'SEARCHING' },
        data: { status: 'ACCEPTED', masterId: masterUserId, acceptedAt: new Date() },
      });
      if (gate.count === 0) throw new ConflictException('Заявку уже принял другой мастер');

      await tx.orderOffer.update({
        where: { id: offer.id },
        data: { outcome: 'ACCEPTED', respondedAt: new Date() },
      });
      const rest = await tx.orderOffer.findMany({
        where: { orderId, attempt: order.searchAttempt, outcome: 'PENDING' },
      });
      await tx.orderOffer.updateMany({
        where: { id: { in: rest.map((o) => o.id) } },
        data: { outcome: 'LOST', respondedAt: new Date() },
      });
      return rest;
    });

    await this.payments.capture(orderId); // идемпотентен: при повторном поиске capture уже есть
    for (const o of losers) {
      this.gateway.emitToUser(o.masterUserId, 'offer:closed', { orderId, reason: 'Заявку принял другой мастер' });
    }
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  /** SEARCHING → NO_MASTERS: void холда, гашение PENDING-офферов, WS. */
  async markNoMasters(orderId: string): Promise<void> {
    const pending = await this.prisma.$transaction(async (tx) => {
      await this.gate(orderId, 'SEARCHING', { status: 'NO_MASTERS' }, tx);
      const offers = await tx.orderOffer.findMany({ where: { orderId, outcome: 'PENDING' } });
      await tx.orderOffer.updateMany({
        where: { id: { in: offers.map((o) => o.id) } },
        data: { outcome: 'EXPIRED' },
      });
      return offers;
    });
    await this.payments.void(orderId); // после capture (отмена мастером) mock трактует как возврат
    for (const o of pending) {
      this.gateway.emitToUser(o.masterUserId, 'offer:closed', { orderId, reason: 'Поиск завершён' });
    }
    await this.emitOrderStatus(orderId);
  }

  onModuleInit(): void {
    this.queue.register(JOBS.PRICE_TIMEOUT, (d: { orderId: string }) => this.handlePriceTimeout(d));
    this.queue.register(JOBS.AUTO_CLOSE, (d: { orderId: string }) => this.handleAutoClose(d));
  }

  /** Заявка принадлежит мастеру? Иначе 403. */
  private async guardMaster(masterUserId: string, orderId: string) {
    const order = await this.findOrThrow(orderId);
    if (order.masterId !== masterUserId) throw new ForbiddenException('Нет доступа к заявке');
    return order;
  }

  private async guardClient(clientId: string, orderId: string) {
    const order = await this.findOrThrow(orderId);
    if (order.clientId !== clientId) throw new ForbiddenException('Нет доступа к заявке');
    return order;
  }

  async onWay(masterUserId: string, orderId: string) {
    await this.guardMaster(masterUserId, orderId);
    await this.gate(orderId, 'ACCEPTED', { status: 'MASTER_ON_WAY' });
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async onSite(masterUserId: string, orderId: string) {
    await this.guardMaster(masterUserId, orderId);
    await this.gate(orderId, 'MASTER_ON_WAY', { status: 'INSPECTION', onSiteAt: new Date() });
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async proposePrice(masterUserId: string, orderId: string, dto: ProposePriceDto) {
    await this.guardMaster(masterUserId, orderId);
    await this.gate(orderId, 'INSPECTION', {
      status: 'AWAITING_PRICE_CONFIRM',
      workPrice: dto.amount,
      workComment: dto.comment ?? null,
      priceProposedAt: new Date(),
    });
    await this.queue.send(JOBS.PRICE_TIMEOUT, { orderId }, PRICE_CONFIRM_TIMEOUT_S);
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async confirmPrice(clientId: string, orderId: string) {
    await this.guardClient(clientId, orderId);
    await this.gate(orderId, 'AWAITING_PRICE_CONFIRM', { status: 'IN_PROGRESS' });
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async rejectPrice(clientId: string, orderId: string) {
    await this.guardClient(clientId, orderId);
    await this.cancelPaidFromAwaiting(orderId, 'Клиент отклонил цену работ');
    return this.findOrThrow(orderId);
  }

  /** Джоба: клиент молчал 15 минут. Не в AWAITING — тихий выход (идемпотентность). */
  async handlePriceTimeout({ orderId }: { orderId: string }): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'AWAITING_PRICE_CONFIRM') return;
    await this.cancelPaidFromAwaiting(orderId, 'Таймаут подтверждения цены (15 минут)');
  }

  /** AWAITING_PRICE_CONFIRM → CANCELLED_BY_CLIENT с удержанием сбора и компенсацией мастеру (§3.9). */
  private async cancelPaidFromAwaiting(orderId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.gate(orderId, 'AWAITING_PRICE_CONFIRM', { status: 'CANCELLED_BY_CLIENT', cancelReason: reason }, tx);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      await this.accrueCompensation(tx, order);
    });
    await this.emitOrderStatus(orderId);
  }

  async complete(masterUserId: string, orderId: string) {
    await this.guardMaster(masterUserId, orderId);
    await this.gate(orderId, 'IN_PROGRESS', { status: 'DONE', completedAt: new Date() });
    await this.queue.send(JOBS.AUTO_CLOSE, { orderId }, AUTO_CLOSE_S);
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async confirmCompletion(clientId: string, orderId: string) {
    await this.guardClient(clientId, orderId);
    await this.closeOrder(orderId);
    return this.findOrThrow(orderId);
  }

  /** Джоба: клиент молчал 24 ч после «Выполнено». */
  async handleAutoClose({ orderId }: { orderId: string }): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'DONE') return;
    await this.closeOrder(orderId);
  }

  /** DONE → CLOSED + компенсация мастеру (§3.8). */
  private async closeOrder(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.gate(orderId, 'DONE', { status: 'CLOSED', closedAt: new Date() }, tx);
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      await this.accrueCompensation(tx, order);
    });
    await this.emitOrderStatus(orderId);
  }
}
