import { isLegacyPlannedOrder, requireLegacyPlannedOrder } from './planned-lifecycle';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PlannedOrder, Prisma, User } from '@prisma/client';
import { isUUID } from 'class-validator';
import { plannedCreationPayloadHash } from './planned-creation-payload';
import { PrismaService } from '../prisma/prisma.service';
import { MasterPenaltyService } from '../common/master-penalty.service';
import { DisputesService } from '../disputes/disputes.service';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';
import { ReviewsService } from '../reviews/reviews.service';
import {
  FEED_SELECT,
  PLANNED_AUTO_CLOSE_S,
  PLANNED_CONFIRM_TIMEOUT_S,
  PLANNED_HORIZON_DAYS,
  PLANNED_MAX_BIDS,
  PLANNED_ORDER_INCLUDE,
} from './planned-order.constants';
import { CreateIdempotentPlannedOrderDto, CreatePlannedOrderDto, PlaceBidDto, SelectBidDto } from './dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PlannedOrdersService implements OnModuleInit {
  private readonly logger = new Logger(PlannedOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly gateway: RealtimeGateway,
    private readonly penalties: MasterPenaltyService,
    private readonly disputes: DisputesService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly reviews: ReviewsService,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.PLANNED_CONFIRM_TIMEOUT, (d: { plannedOrderId: string; bidId: string }) =>
      this.handleConfirmTimeout(d),
    );
    this.queue.register(JOBS.PLANNED_AUTO_CLOSE, (d: { plannedOrderId: string }) => this.handleAutoClose(d));
    this.queue.register(JOBS.PLANNED_EXPIRY, (d: { plannedOrderId: string }) => this.handlePlannedExpiry(d));
    this.queue.registerCron(JOBS.PLANNED_CREATION_EXPIRY_RECOVERY, '* * * * *', () => this.recoverCreationExpiry());
  }

  async create(clientId: string, dto: CreatePlannedOrderDto) {
    const dates = await this.validateCreation(dto, this.prisma);
    const order = await this.prisma.$transaction((tx) => this.persistCreation(tx, clientId, dto, dates));
    const delaySeconds = Math.max(0, Math.floor((dates.slotStart.getTime() - Date.now()) / 1000));
    await this.queue.send(JOBS.PLANNED_EXPIRY, { plannedOrderId: order.id }, delaySeconds);
    return this.findOrThrow(order.id);
  }

  async createIdempotent(
    clientId: string,
    dto: CreateIdempotentPlannedOrderDto,
    assertPhotosAvailable: (tx: Tx) => Promise<void>,
  ) {
    if (!isUUID(dto.clientRequestId)) throw new BadRequestException('clientRequestId must be a UUID');
    if (!Number.isFinite(Date.parse(dto.slotStart)) || !Number.isFinite(Date.parse(dto.slotEnd))) {
      throw new BadRequestException('Invalid planned slot');
    }
    const requestKey = dto.clientRequestId.toLowerCase();
    const payloadHash = plannedCreationPayloadHash(dto);
    const creation = await this.prisma.$transaction(async (tx) => {
      // All retries for an authenticated owner serialize before transient checks.
      // The unique key remains the database backstop; no field-based matching.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${clientId} FOR UPDATE`;
      const previous = await tx.plannedOrderCreationRequest.findUnique({
        where: { ownerId_requestKey: { ownerId: clientId, requestKey } },
      });
      if (previous) {
        if (previous.payloadHash !== payloadHash) throw new ConflictException('IDEMPOTENCY_PAYLOAD_MISMATCH');
        return { record: previous, replayed: true };
      }
      const dates = await this.validateCreation(dto, tx);
      await assertPhotosAvailable(tx);
      const order = await this.persistCreation(tx, clientId, dto, dates);
      const record = await tx.plannedOrderCreationRequest.create({
        data: { ownerId: clientId, requestKey, payloadHash, orderId: order.id },
      });
      return { record, replayed: false };
    });
    const order = await this.guardClient(clientId, creation.record.orderId);
    await this.scheduleCreationExpiry(creation.record, order.slotStart);
    return { order: this.redactMasterContact(order), replayed: creation.replayed };
  }

  /** The committed identity also acts as an outbox, including across process restarts. */
  async recoverCreationExpiry(): Promise<void> {
    if (this.queue.healthCheck().status !== 'UP') return;
    const pending = await this.prisma.plannedOrderCreationRequest.findMany({
      where: { expiryScheduledAt: null, order: { lifecycleModel: 'LEGACY' } },
      include: { order: { select: { slotStart: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const record of pending) await this.scheduleCreationExpiry(record, record.order.slotStart);
  }

  private async scheduleCreationExpiry(
    record: { orderId: string; expiryScheduledAt: Date | null },
    slotStart: Date,
  ): Promise<void> {
    if (record.expiryScheduledAt || this.queue.healthCheck().status !== 'UP') return;
    try {
      const delaySeconds = Math.max(0, Math.ceil((slotStart.getTime() - Date.now()) / 1000));
      await this.queue.send(JOBS.PLANNED_EXPIRY, { plannedOrderId: record.orderId }, delaySeconds);
      await this.prisma.plannedOrderCreationRequest.update({
        where: { orderId: record.orderId },
        data: { expiryScheduledAt: new Date() },
      });
    } catch {
      // A send/marker crash can repeat expiry delivery, but cannot recreate the order.
      // The expiry handler gates the state transition; the pending row is retried.
      this.logger.warn(`Planned expiry dispatch pending for ${record.orderId}`);
    }
  }

  private async validateCreation(dto: CreatePlannedOrderDto, db: Tx) {
    const category = await db.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException('Неизвестная категория');

    const slotStart = new Date(dto.slotStart);
    const slotEnd = new Date(dto.slotEnd);
    const now = new Date();
    const horizon = new Date(now.getTime() + PLANNED_HORIZON_DAYS * 24 * 3600 * 1000);
    if (slotStart <= now) throw new BadRequestException('Дата должна быть в будущем');
    if (slotStart > horizon) {
      throw new BadRequestException(`Дата должна быть не позднее ${PLANNED_HORIZON_DAYS} дней вперёд`);
    }
    if (slotEnd <= slotStart) throw new BadRequestException('Конец слота должен быть позже начала');

    return { slotStart, slotEnd, now };
  }

  private async persistCreation(
    tx: Tx,
    clientId: string,
    dto: CreatePlannedOrderDto,
    { slotStart, slotEnd, now }: { slotStart: Date; slotEnd: Date; now: Date },
  ) {
    const created = await tx.plannedOrder.create({
      data: {
        clientId,
        lifecycleModel: 'LEGACY',
        categoryId: dto.categoryId,
        description: dto.description,
        address: dto.address,
        district: dto.district,
        entrance: dto.entrance ?? null,
        floor: dto.floor ?? null,
        apartment: dto.apartment ?? null,
        addressComment: dto.addressComment ?? null,
        budget: dto.budget ?? null,
        slotStart,
        slotEnd,
        status: 'PUBLISHED',
        publishedAt: now,
      },
    });
    if (dto.photoPaths?.length) {
      await tx.plannedOrderPhoto.createMany({
        data: dto.photoPaths.map((path) => ({ plannedOrderId: created.id, path })),
      });
    }
    return created;
  }

  async listMine(clientId: string) {
    const orders = await this.prisma.plannedOrder.findMany({
      where: { clientId, lifecycleModel: 'LEGACY' },
      orderBy: { createdAt: 'desc' },
      include: PLANNED_ORDER_INCLUDE,
    });
    return Promise.all(
      orders.map(async (order) => {
        const withBids = { ...order, bids: await this.enrichBids(order.bids) };
        return this.reviews.attachRating(this.redactMasterContact(withBids));
      }),
    );
  }

  private withDeadline<T extends { selectedAt: Date | null; status: string }>(order: T) {
    return {
      ...order,
      confirmDeadline:
        order.selectedAt && order.status === 'MASTER_SELECTED'
          ? new Date(order.selectedAt.getTime() + PLANNED_CONFIRM_TIMEOUT_S * 1000).toISOString()
          : null,
    };
  }

  async findOrThrow(id: string) {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id }, include: PLANNED_ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Заявка не найдена');
    requireLegacyPlannedOrder(order);
    const dispute = await this.prisma.dispute.findFirst({ where: { plannedOrderId: id }, orderBy: { createdAt: 'desc' } });
    const withBids = { ...order, bids: await this.enrichBids(order.bids), dispute };
    return this.reviews.attachRating(this.withDeadline(withBids));
  }

  /**
   * Заявка для ответа КЛИЕНТУ: телефон мастера скрыт, пока статус вне
   * MASTER_CONTACT_REVEALED_STATUSES (§3.4 шаг 7).
   *
   * Мутации, отдающие заявку клиенту, обязаны возвращать этот метод, а не сырой
   * findOrThrow: телефон уже трижды утекал через забытый call-site — getByIdForUser,
   * listMine и путь отмены. Для мастера метод безопасен: cancelByMaster обнуляет
   * masterId, поэтому редакция становится no-op.
   */
  async findOrThrowForClient(id: string) {
    return this.redactMasterContact(await this.findOrThrow(id));
  }

  private async enrichBids<
    T extends { masterUserId: string; master: { id: string; name: string | null; masterProfile: { experienceYears: number; status: string } | null } },
  >(bids: T[]) {
    const counts = await Promise.all(
      bids.map((b) =>
        Promise.all([
          this.prisma.order.count({ where: { masterId: b.masterUserId, status: 'CLOSED' } }),
          this.prisma.plannedOrder.count({ where: { masterId: b.masterUserId, lifecycleModel: 'LEGACY', status: 'CLOSED' } }),
          this.reviews.getMasterRatingSummary(b.masterUserId),
        ]),
      ),
    );
    return bids.map((b, i) => ({
      ...b,
      master: {
        id: b.master.id,
        name: b.master.name,
        experienceYears: b.master.masterProfile?.experienceYears ?? 0,
        completedCount: counts[i][0] + counts[i][1],
        verified: b.master.masterProfile?.status === 'ACTIVE',
        rating: counts[i][2].rating,
        reviewCount: counts[i][2].reviewCount,
      },
    }));
  }

  /** Атомарный гейт перехода. count===0 → 409. */
  async gate(
    id: string,
    from: Prisma.Enumerable<PlannedOrder['status']>,
    data: Prisma.PlannedOrderUpdateManyMutationInput | Prisma.PlannedOrderUncheckedUpdateManyInput,
    tx: Tx = this.prisma,
  ): Promise<void> {
    const res = await tx.plannedOrder.updateMany({
      where: { id, lifecycleModel: 'LEGACY', status: Array.isArray(from) ? { in: from } : from },
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

  /** Назначенный мастер заявки? Иначе 403. */
  private async guardMaster(masterUserId: string, id: string) {
    const order = await this.findOrThrow(id);
    if (order.masterId !== masterUserId) throw new ForbiddenException('Нет доступа к заявке');
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
      where: { lifecycleModel: 'LEGACY', status: 'PUBLISHED', categoryId: { in: categoryIds } },
      orderBy: { slotStart: 'asc' },
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
        requireLegacyPlannedOrder(order);
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
    if (!order || !isLegacyPlannedOrder(order) || order.status !== 'MASTER_SELECTED' || order.selectedBidId !== bidId) return;
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

  async onSite(masterUserId: string, plannedOrderId: string) {
    await this.guardMaster(masterUserId, plannedOrderId);
    await this.gate(plannedOrderId, 'CONFIRMED', { status: 'IN_PROGRESS' });
    await this.emitPlannedStatus(plannedOrderId);
    return this.findOrThrow(plannedOrderId);
  }

  async complete(masterUserId: string, plannedOrderId: string) {
    await this.guardMaster(masterUserId, plannedOrderId);
    await this.gate(plannedOrderId, 'IN_PROGRESS', { status: 'DONE', completedAt: new Date() });
    await this.queue.send(JOBS.PLANNED_AUTO_CLOSE, { plannedOrderId }, PLANNED_AUTO_CLOSE_S);
    await this.emitPlannedStatus(plannedOrderId);
    return this.findOrThrow(plannedOrderId);
  }

  async confirmCompletion(clientId: string, plannedOrderId: string) {
    await this.guardClient(clientId, plannedOrderId);
    await this.closeOrder(plannedOrderId);
    return this.findOrThrow(plannedOrderId);
  }

  /** Джоба: клиент молчал 24ч после «Выполнено». Заморожена, пока открыт спор. */
  async handleAutoClose({ plannedOrderId }: { plannedOrderId: string }): Promise<void> {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId } });
    if (!order || !isLegacyPlannedOrder(order) || order.status !== 'DONE') return;
    if (await this.disputes.hasOpenDispute({ plannedOrderId })) return;
    await this.closeOrder(plannedOrderId);
  }

  private async closeOrder(plannedOrderId: string): Promise<void> {
    await this.gate(plannedOrderId, 'DONE', { status: 'CLOSED', closedAt: new Date() });
    await this.emitPlannedStatus(plannedOrderId);
  }

  /** Джоба: наступил slotStart, а заявка ещё PUBLISHED без единой ставки. */
  async handlePlannedExpiry({ plannedOrderId }: { plannedOrderId: string }): Promise<void> {
    const order = await this.prisma.plannedOrder.findUnique({
      where: { id: plannedOrderId },
      include: { _count: { select: { bids: true } } },
    });
    if (!order || !isLegacyPlannedOrder(order) || order.status !== 'PUBLISHED' || order._count.bids > 0) return;
    await this.gate(plannedOrderId, 'PUBLISHED', { status: 'EXPIRED' });
    await this.emitPlannedStatus(plannedOrderId);
  }

  async emitPlannedStatus(plannedOrderId: string): Promise<void> {
    const order = await this.prisma.plannedOrder.findUnique({ where: { id: plannedOrderId }, include: PLANNED_ORDER_INCLUDE });
    if (!order || !isLegacyPlannedOrder(order)) return;
    const base = {
      plannedOrderId: order.id,
      status: order.status,
      workPrice: order.workPrice,
      cancelReason: order.cancelReason,
      slotStart: order.slotStart,
      slotEnd: order.slotEnd,
    };
    this.gateway.emitToUser(order.clientId, 'planned:status', { ...base, master: this.redactMasterContact(order).master });
    if (order.masterId) this.gateway.emitToUser(order.masterId, 'planned:status', { ...base, master: order.master });
  }

  async cancel(user: User, plannedOrderId: string): Promise<PlannedOrder> {
    const order = await this.findOrThrow(plannedOrderId);
    if (order.clientId === user.id) {
      await this.cancelByClient(order);
    } else if (order.masterId === user.id) {
      await this.cancelByMaster(order);
    } else {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    return this.findOrThrowForClient(plannedOrderId);
  }

  private async cancelByClient(order: PlannedOrder): Promise<void> {
    const before: PlannedOrder['status'][] = ['CREATED', 'PUBLISHED'];
    const after: PlannedOrder['status'][] = ['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'];

    if (before.includes(order.status)) {
      await this.gate(order.id, before, { status: 'CANCELLED_BY_CLIENT', cancelReason: 'Отменена клиентом' });
      await this.emitPlannedStatus(order.id);
      return;
    }

    if (after.includes(order.status)) {
      await this.prisma.$transaction(async (tx) => {
        await this.gate(
          order.id,
          after,
          { status: 'CANCELLED_BY_CLIENT', cancelReason: 'Отменена клиентом после выбора мастера' },
          tx,
        );
        if (order.masterId) {
          await tx.leadCreditAccount.update({
            where: { masterUserId: order.masterId },
            data: { balance: { increment: 1 } },
          });
          await tx.leadCreditTransaction.create({
            data: { masterUserId: order.masterId, type: 'REFUND', amount: 1, bidId: order.selectedBidId },
          });
        }
      });
      await this.emitPlannedStatus(order.id);
      return;
    }

    throw new ConflictException('На этом этапе отмена недоступна');
  }

  private async cancelByMaster(order: PlannedOrder): Promise<void> {
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(order.status)) {
      throw new ConflictException('На этом этапе отмена недоступна');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.gate(
        order.id,
        ['CONFIRMED', 'IN_PROGRESS'],
        { status: 'PUBLISHED', masterId: null, selectedBidId: null, selectedAt: null, confirmedAt: null },
        tx,
      );
      await this.penalties.penalizeForCancellation(tx, order.masterId!, 'PLANNED', order.id);
    });
    await this.emitPlannedStatus(order.id);
  }

  async getPhotoStream(user: User, plannedOrderId: string, photoId: string) {
    const order = await this.findOrThrow(plannedOrderId);
    if (order.clientId !== user.id && order.masterId !== user.id && user.role !== 'OPERATOR') {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    const photo = order.photos.find((p) => p.id === photoId);
    if (!photo) throw new NotFoundException('Фото не найдено');
    return this.storage.absolutePath(photo.path);
  }

  async getByIdForUser(user: User, id: string) {
    const order = await this.findOrThrow(id);
    if (order.clientId === user.id) return this.redactMasterContact(order);
    const revealed = order.masterId === user.id;
    if (revealed) return order;
    // Only the public feed case may be read by a nonparticipant. An assigned or
    // historical order is private even when its contact fields are redacted.
    // Preserve the operator's existing redacted read; do not broaden privileges.
    if (user.role === 'OPERATOR') return { ...order, ...PlannedOrdersService.NON_PRIVILEGED_REDACTION(order) };
    if (order.masterId || order.status !== 'PUBLISHED') throw new ForbiddenException('No access to this order');
    const membership = await this.prisma.masterCategory.findFirst({
      where: { categoryId: order.categoryId, masterProfile: { userId: user.id, status: 'ACTIVE' } },
      select: { categoryId: true },
    });
    if (!membership) throw new ForbiddenException('No access to this order');
    const ownBid = order.bids.find(bid => bid.masterUserId === user.id);
    return {
      ...order,
      ...PlannedOrdersService.NON_PRIVILEGED_REDACTION(order),
      dispute: null,
      ownBid: ownBid ? { id: ownBid.id, masterUserId: ownBid.masterUserId, price: ownBid.price, term: ownBid.term, comment: ownBid.comment, createdAt: ownBid.createdAt } : null,
      _count: { bids: order.bids.length },
    };
  }

  /**
   * Поля, скрываемые от мастера, который заявку не выиграл (не назначен): точный адрес,
   * детали доступа и фото — потенциальные метки геолокации до того, как мастер вложился в отклик.
   * `budget` намеренно не редактируется — уже публично виден в feed().
   */
  private static readonly NON_PRIVILEGED_REDACTION = (order: {
    master: { id: string; name: string | null; phone: string } | null;
  }) => ({
    address: null,
    entrance: null,
    floor: null,
    apartment: null,
    addressComment: null,
    photos: [] as never[],
    client: null,
    master: order.master ? { ...order.master, phone: '' } : null,
    bids: [] as never[],
  });

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
