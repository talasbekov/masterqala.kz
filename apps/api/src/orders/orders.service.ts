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
import {creationPayloadHash} from './order-creation-request.service';
import { DirectOrderLifecycleService } from './direct-order-lifecycle.service';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '../payments/payment.interface';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MasterPenaltyService } from '../common/master-penalty.service';
import { CompensationService } from '../common/compensation.service';
import { DisputesService } from '../disputes/disputes.service';
import { ReviewsService } from '../reviews/reviews.service';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  ACTIVE_CLIENT_STATUSES,
  ACTIVE_MASTER_STATUSES,
  AUTO_CLOSE_S,
  ORDER_INCLUDE,
  PRICE_CONFIRM_TIMEOUT_S,
} from './order.constants';
import { CreateOrderDto, PreviewOrderDto, ProposePriceDto, QuoteVersionDto, CancelOrderDto } from './dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly queue: QueueService,
    private readonly gateway: RealtimeGateway,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    private readonly penalties: MasterPenaltyService,
    private readonly compensation: CompensationService,
    private readonly disputes: DisputesService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly reviews: ReviewsService,
    private readonly auditLog: AuditLogService,
    private readonly commercialMode: CommercialModeService,
    private readonly directLifecycle: DirectOrderLifecycleService,
  ) {}

  async pendingOffer(masterUserId:string) {
    const offer=await this.prisma.orderOffer.findFirst({
      where:{masterUserId,outcome:'PENDING',sequential:true,expiresAt:{gt:new Date()},order:{status:'SEARCHING',dispatchMode:'SEQUENTIAL'}},
      include:{order:{include:{category:true}}},orderBy:{sentAt:'desc'},
    });
    if(!offer||offer.attempt!==offer.order.searchAttempt||!offer.expiresAt)return null;
    return {orderId:offer.orderId,offerId:offer.id,category:offer.order.category.name,description:offer.order.description,district:offer.order.district,
      commercialMode:'DIRECT_PAYMENT',directPayment:true,compensation:0,freePilot:false,distanceKm:offer.distanceKm,deadline:offer.expiresAt.toISOString(),wave:1};
  }

  async preview(clientId: string, dto: PreviewOrderDto) {
    if (this.commercialMode.mode() === 'DIRECT_PAYMENT') {
      return { available: true, commercialMode: 'DIRECT_PAYMENT', quoteRequired: true, calloutPrice: 0, serviceFee: 0 };
    }
    const quote = await this.pricing.quote(
      dto.categoryId,
      { lat: dto.lat, lng: dto.lng },
      clientId,
    );
    return quote ? { available: true, ...quote } : { available: false };
  }

  async createWithRequest(clientId:string,dto:CreateOrderDto){return this.createInternal(clientId,dto);}

  async create(clientId: string, dto: CreateOrderDto) {return (await this.createInternal(clientId,dto)).order;}

  private async createInternal(clientId:string,dto:CreateOrderDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new BadRequestException('Неизвестная категория');

    // A keyed replay may commit after the coordinator's initial lookup.
    // Do not reject it through an unlocked outside active-order count.
    if(!dto.clientRequestId){
      const active=await this.prisma.order.count({where:{clientId,status:{in:ACTIVE_CLIENT_STATUSES}}});
      if(active>0)throw new ConflictException('У вас уже есть активная заявка');
    }

    const direct = this.commercialMode.mode() === 'DIRECT_PAYMENT';
    const quote = direct ? { calloutPrice: 0, serviceFee: 0 } : await this.pricing.quote(
      dto.categoryId,
      { lat: dto.lat, lng: dto.lng },
      clientId,
    );
    if (!quote) throw new UnprocessableEntityException('Мастеров рядом нет');

    const creation = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${clientId} FOR UPDATE`;
      if(dto.clientRequestId){
        const previous=await tx.orderCreationRequest.findUnique({where:{ownerId_requestKey:{ownerId:clientId,requestKey:dto.clientRequestId}}});
        if(previous){
          if(previous.payloadHash!==creationPayloadHash(dto))throw new ConflictException('IDEMPOTENCY_PAYLOAD_MISMATCH');
          return {orderId:previous.orderId,replayed:true as const,created:null};
        }
      }
      if (await tx.order.count({where:{clientId,status:{in:ACTIVE_CLIENT_STATUSES}}})) {
        throw new ConflictException('У вас уже есть активная заявка');
      }
      const created = await tx.order.create({
        data: {
          clientId,
          commercialMode: this.commercialMode.mode(),
          lifecycleVersion: direct ? 2 : 1,
          dispatchMode: direct ? 'SEQUENTIAL' : 'WAVE',
          categoryId: dto.categoryId,
          description: dto.description,
          address: dto.address,
          district: dto.district,
          lat: dto.lat,
          lng: dto.lng,
          entrance: dto.entrance ?? null,
          floor: dto.floor ?? null,
          apartment: dto.apartment ?? null,
          addressComment: dto.addressComment ?? null,
          calloutPrice: quote.calloutPrice,
          serviceFee: quote.serviceFee,
        },
      });
      await tx.$executeRaw`
        UPDATE "Order"
        SET location = ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography
        WHERE id = ${created.id}`;
      if (dto.photoPaths?.length) {
        await tx.orderPhoto.createMany({
          data: dto.photoPaths.map((path) => ({ orderId: created.id, path })),
        });
      }
      if(dto.clientRequestId)await tx.orderCreationRequest.create({data:{ownerId:clientId,requestKey:dto.clientRequestId,payloadHash:creationPayloadHash(dto),orderId:created.id}});
      return {orderId:created.id,replayed:false as const,created};
    });
    if(creation.replayed)return {order:await this.findOrThrow(creation.orderId),replayed:true};
    const order=creation.created;

    // Холд на полную стоимость выезда, не только на сбор: при ПРИНЯТА капчится
    // целиком, платформа удерживает serviceFee себе, остаток уходит мастеру
    // компенсацией (accrueCallout = calloutPrice − serviceFee) — без этого
    // с реальным провайдером компенсация платилась бы из денег, которых
    // платформа не собирала (P0, §23 отчёта).
    // Ошибка холда → заявка остаётся CREATED и не публикуется (§3.3).
    if (!direct) await this.payments.hold(order.id, order.calloutPrice);
    await this.gate(order.id, 'CREATED', { status: 'SEARCHING' });
    await this.queue.send(direct ? JOBS.SEQUENTIAL_DISPATCH : JOBS.WAVE, direct ? {orderId:order.id,attempt:order.searchAttempt} : { orderId: order.id, wave: 1 });
    return {order:await this.findOrThrow(order.id),replayed:false};
  }

  async getActive(clientId: string) {
    const order = await this.prisma.order.findFirst({
      where: { clientId, status: { in: ACTIVE_CLIENT_STATUSES } },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return { order: order ? await this.reviews.attachRating(this.withDeadlines(order)) : null };
  }

  async listMine(clientId: string) {
    const orders = await this.prisma.order.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
    return this.reviews.attachRatingToAll(orders.map((o) => this.withDeadlines(o)));
  }

  async getMasterActive(masterUserId: string) {
    const order = await this.prisma.order.findFirst({
      where: { masterId: masterUserId, OR:[{status:{in:ACTIVE_MASTER_STATUSES}},{lifecycleVersion:{gte:2},status:'DONE'}] },
      include: ORDER_INCLUDE,
    });
    return { order: order ? await this.reviews.attachRating(this.withDeadlines(order)) : null };
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
    const dispute = await this.prisma.dispute.findFirst({ where: { orderId: id }, orderBy: { createdAt: 'desc' } });
    return this.reviews.attachRating(this.withDeadlines({ ...order, dispute }));
  }

  async getPhotoStream(user: User, orderId: string, photoId: string) {
    const order = await this.findOrThrow(orderId);
    if (order.clientId !== user.id && order.masterId !== user.id && user.role !== 'OPERATOR') {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    const photo = order.photos.find((p) => p.id === photoId);
    if (!photo) throw new NotFoundException('Фото не найдено');
    return this.storage.absolutePath(photo.path);
  }

  private withDeadlines<T extends { priceProposedAt: Date | null; lifecycleVersion?:number; quoteVersion?:number;workPrice?:number|null;materialsPrice?:number;calloutPrice?:number }>(order: T) {
    return {
      ...order,
      ...(order.lifecycleVersion && order.lifecycleVersion>=2 ? {quoteTotal:order.quoteVersion ? (order.workPrice??0)+(order.materialsPrice??0)+(order.calloutPrice??0):null} : {}),
      priceDeadline: order.priceProposedAt && (!order.lifecycleVersion || order.lifecycleVersion<2)
        ? new Date(order.priceProposedAt.getTime() + PRICE_CONFIRM_TIMEOUT_S * 1000).toISOString()
        : null,
    };
  }

  async findOrThrow(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Заявка не найдена');
    const dispute = await this.prisma.dispute.findFirst({ where: { orderId: id }, orderBy: { createdAt: 'desc' } });
    return this.reviews.attachRating(this.withDeadlines({ ...order, dispute }));
  }

  /** Атомарный гейт перехода. count===0 → 409. */
  async gate(
    orderId: string,
    from: Prisma.Enumerable<Order['status']>,
    data: Prisma.OrderUpdateManyMutationInput | Prisma.OrderUncheckedUpdateManyInput,
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
    return this.compensation.accrueCallout(tx, order);
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
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Заявка не найдена');
      if (order.status !== 'SEARCHING') throw new ConflictException('Заявку уже принял другой мастер');
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${masterUserId} FOR UPDATE`;
      const busy = await tx.order.count({
        where: { masterId: masterUserId, OR:[{status:{in:ACTIVE_MASTER_STATUSES}}, {lifecycleVersion:{gte:2},status:'DONE'}] },
      });
      if (busy > 0 || await tx.plannedOrder.count({where:{masterId:masterUserId,status:'IN_PROGRESS'}})) {
        throw new ConflictException('У вас уже есть активная заявка');
      }
      if(order.lifecycleVersion>=2) {
        const profile=await tx.masterProfile.findUnique({where:{userId:masterUserId}});
        const account=await tx.user.findUnique({where:{id:masterUserId}});
        if(!profile || profile.status!=='ACTIVE' || account?.isBlocked || (profile.blockedUntil && profile.blockedUntil>new Date())) {
          throw new ForbiddenException('Мастер недоступен для назначения');
        }
      }

      const offer = await tx.orderOffer.findFirst({
        where: { orderId, masterUserId, attempt: order.searchAttempt, outcome: 'PENDING' },
      });
      if (!offer) throw new ForbiddenException('Предложение недоступно');
      if (offer.sequential && (!offer.expiresAt || offer.expiresAt <= new Date())) throw new ConflictException('Время на принятие истекло');

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

    if ((await this.findOrThrow(orderId)).commercialMode !== 'DIRECT_PAYMENT') await this.payments.capture(orderId);
    for (const o of losers) {
      this.gateway.emitToUser(o.masterUserId, 'offer:closed', { orderId, reason: 'Заявку принял другой мастер' });
    }
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async declineOffer(masterUserId: string, orderId: string) {
    const attempt = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
      const order=await tx.order.findUnique({where:{id:orderId}});
      if(!order || order.dispatchMode!=='SEQUENTIAL' || order.status!=='SEARCHING') throw new ConflictException('Предложение недоступно');
      const offer=await tx.orderOffer.findFirst({where:{orderId,masterUserId,attempt:order.searchAttempt,sequential:true}});
      if(!offer) throw new ForbiddenException('Предложение недоступно');
      if(offer.outcome==='PENDING') await tx.orderOffer.update({where:{id:offer.id},data:{outcome:'EXPIRED',respondedAt:new Date()}});
      return order.searchAttempt;
    });
    this.gateway.emitToUser(masterUserId,'offer:closed',{orderId,reason:'Предложение пропущено'});
    await this.queue.send(JOBS.SEQUENTIAL_DISPATCH,{orderId,attempt});
    return {orderId};
  }

  /** Операторское назначение зависшего в поиске заказа конкретному мастеру, в обход offer-flow. */
  async manualAssign(operatorId: string, orderId: string, masterUserId: string): Promise<Order> {
    const losers = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Заявка не найдена');
      if (order.clientId === masterUserId) {
        throw new ConflictException('Нельзя назначить клиента заявки мастером на неё же');
      }

      // masterUserId приходит из тела запроса оператора — нельзя доверять,
      // что он взят из /candidates: типо/устаревший id иначе даёт либо сырую
      // P2003 (FK) на updateMany ниже, либо тихое двойное бронирование занятого
      // мастера. Валидируем «активный мастер» + «сейчас свободен» тем же
      // критерием, что и candidates()/matching.service.ts.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${masterUserId} FOR UPDATE`;
      const profile = await tx.masterProfile.findUnique({ where: { userId: masterUserId } });
      if (!profile) throw new NotFoundException('Мастер не найден');
      if (profile.status !== 'ACTIVE' || (profile.blockedUntil && profile.blockedUntil > new Date())) {
        throw new ConflictException('Мастер недоступен для назначения');
      }
      // Блокировка оператором живёт в User.isBlocked и в MasterProfile никак не
      // отражается, поэтому проверяется отдельно — иначе оператор мог бы вручную
      // назначить заявку на пользователя, которого сам же заблокировал.
      const account = await tx.user.findUnique({
        where: { id: masterUserId },
        select: { isBlocked: true },
      });
      if (account?.isBlocked) {
        throw new ConflictException('Мастер недоступен для назначения: аккаунт заблокирован');
      }
      const busy = await tx.order.count({
        where: { masterId: masterUserId, OR:[{status:{in:ACTIVE_MASTER_STATUSES}},{lifecycleVersion:{gte:2},status:'DONE'}] },
      });
      if (busy > 0) throw new ConflictException('Мастер уже занят другой заявкой');

      const gate = await tx.order.updateMany({
        where: { id: orderId, status: 'SEARCHING' },
        data: { status: 'ACCEPTED', masterId: masterUserId, acceptedAt: new Date() },
      });
      if (gate.count === 0) throw new ConflictException('Заявка больше не в поиске');

      const rest = await tx.orderOffer.findMany({
        where: { orderId, attempt: order.searchAttempt, outcome: 'PENDING' },
      });
      await tx.orderOffer.updateMany({
        where: { id: { in: rest.map((o) => o.id) } },
        data: { outcome: 'LOST', respondedAt: new Date() },
      });

      await this.auditLog.write(
        {
          actorType: 'OPERATOR',
          actorId: operatorId,
          action: 'ORDER_MANUALLY_ASSIGNED',
          targetType: 'ORDER',
          targetId: orderId,
          comment: `назначен мастер ${masterUserId}`,
        },
        tx,
      );

      return rest;
    });

    if ((await this.findOrThrow(orderId)).commercialMode !== 'DIRECT_PAYMENT') await this.payments.capture(orderId);
    for (const o of losers) {
      this.gateway.emitToUser(o.masterUserId, 'offer:closed', { orderId, reason: 'Заявку назначил оператор' });
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
    if((await this.findOrThrow(orderId)).commercialMode !== 'DIRECT_PAYMENT') await this.payments.void(orderId);
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

  private async directResult(result: Promise<Order>) {
    const order=await result;
    await this.emitOrderStatus(order.id);
    return this.findOrThrow(order.id);
  }

  async onWay(masterUserId: string, orderId: string) {
    const current=await this.guardMaster(masterUserId, orderId);
    if(current.lifecycleVersion>=2) return this.directResult(this.directLifecycle.onWay(masterUserId,orderId));
    await this.gate(orderId, 'ACCEPTED', { status: 'MASTER_ON_WAY' });
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async onSite(masterUserId: string, orderId: string) {
    const current=await this.guardMaster(masterUserId, orderId);
    if(current.lifecycleVersion>=2) return this.directResult(this.directLifecycle.onSite(masterUserId,orderId));
    await this.gate(orderId, 'MASTER_ON_WAY', { status: 'INSPECTION', onSiteAt: new Date() });
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async proposePrice(masterUserId: string, orderId: string, dto: ProposePriceDto) {
    const current=await this.guardMaster(masterUserId, orderId);
    if(current.lifecycleVersion>=2) return this.directResult(this.directLifecycle.propose(masterUserId,orderId,dto));
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

  async confirmPrice(clientId: string, orderId: string, dto: QuoteVersionDto = {}) {
    const current=await this.guardClient(clientId, orderId);
    if(current.lifecycleVersion>=2) return this.directResult(this.directLifecycle.approve(clientId,orderId,dto.quoteVersion));
    await this.gate(orderId, 'AWAITING_PRICE_CONFIRM', { status: 'IN_PROGRESS' });
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async startWork(masterUserId:string,orderId:string,dto:QuoteVersionDto) {
    return this.directResult(this.directLifecycle.start(masterUserId,orderId,dto.quoteVersion));
  }

  async rejectPrice(clientId: string, orderId: string, dto:CancelOrderDto={}) {
    const current=await this.guardClient(clientId, orderId);
    if(current.lifecycleVersion>=2) return this.directResult(this.directLifecycle.cancel(clientId,orderId,{...dto,reason:dto.reason??'Клиент отклонил смету'}));
    await this.cancelPaidFromAwaiting(orderId, 'Клиент отклонил цену работ');
    return this.findOrThrow(orderId);
  }

  /** Джоба: клиент молчал 15 минут. Не в AWAITING — тихий выход (идемпотентность). */
  async handlePriceTimeout({ orderId }: { orderId: string }): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.lifecycleVersion>=2 || order.status !== 'AWAITING_PRICE_CONFIRM') return;
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
    const current=await this.guardMaster(masterUserId, orderId);
    if(current.lifecycleVersion>=2) return this.directResult(this.directLifecycle.complete(masterUserId,orderId));
    await this.gate(orderId, 'IN_PROGRESS', { status: 'DONE', completedAt: new Date() });
    await this.queue.send(JOBS.AUTO_CLOSE, { orderId }, AUTO_CLOSE_S);
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }

  async confirmCompletion(clientId: string, orderId: string) {
    const current=await this.guardClient(clientId, orderId);
    if(current.lifecycleVersion>=2) return this.directResult(this.directLifecycle.acceptResult(clientId,orderId));
    await this.closeOrder(orderId);
    return this.findOrThrow(orderId);
  }

  /** Джоба: клиент молчал 24 ч после «Выполнено». Заморожена, пока открыт спор. */
  async handleAutoClose({ orderId }: { orderId: string }): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.lifecycleVersion>=2 || order.status !== 'DONE') return;
    if (await this.disputes.hasOpenDispute({ orderId })) return;
    await this.closeOrder(orderId);
    await this.auditLog.write({ actorType: 'SYSTEM', action: 'AUTO_CLOSED', targetType: 'ORDER', targetId: orderId });
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

  /** §3.9: ветвление по инициатору отмены. */
  async cancellationPreview(user:User,orderId:string) {
    return this.directLifecycle.cancellationPreview(user.id,orderId);
  }

  async cancel(user: User, orderId: string, dto:CancelOrderDto={}): Promise<Order> {
    const order = await this.findOrThrow(orderId);
    if(order.lifecycleVersion>=2 && order.clientId===user.id) {
      const pending=await this.prisma.orderOffer.findMany({where:{orderId,outcome:'PENDING'}});
      const result=await this.directResult(this.directLifecycle.cancel(user.id,orderId,dto));
      for(const offer of pending) this.gateway.emitToUser(offer.masterUserId,'offer:closed',{orderId,offerId:offer.id,reason:'Клиент отменил заявку'});
      return result;
    }
    if (order.clientId === user.id) {
      await this.cancelByClient(order);
    } else if (order.masterId === user.id) {
      await this.cancelByMaster(order);
    } else {
      throw new ForbiddenException('Нет доступа к заявке');
    }
    return this.findOrThrow(orderId);
  }

  private async cancelByClient(order: Order): Promise<void> {
    const free: Order['status'][] = ['CREATED', 'SEARCHING', 'NO_MASTERS'];
    const paid: Order['status'][] = ['ACCEPTED', 'MASTER_ON_WAY'];

    if (free.includes(order.status)) {
      const pending = await this.prisma.$transaction(async (tx) => {
        await this.gate(order.id, free, { status: 'CANCELLED_BY_CLIENT', cancelReason: 'Отменена клиентом' }, tx);
        const offers = await tx.orderOffer.findMany({ where: { orderId: order.id, outcome: 'PENDING' } });
        await tx.orderOffer.updateMany({
          where: { id: { in: offers.map((o) => o.id) } },
          data: { outcome: 'EXPIRED' },
        });
        return offers;
      });
      if (order.status !== 'NO_MASTERS') await this.payments.void(order.id); // в NO_MASTERS уже VOID
      for (const o of pending) {
        this.gateway.emitToUser(o.masterUserId, 'offer:closed', { orderId: order.id, reason: 'Клиент отменил заявку' });
      }
      await this.emitOrderStatus(order.id);
      return;
    }

    if (paid.includes(order.status)) {
      await this.prisma.$transaction(async (tx) => {
        await this.gate(order.id, paid, { status: 'CANCELLED_BY_CLIENT', cancelReason: 'Отменена клиентом после принятия' }, tx);
        const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        await this.accrueCompensation(tx, fresh);
      });
      await this.emitOrderStatus(order.id);
      return;
    }

    if (order.status === 'AWAITING_PRICE_CONFIRM') {
      await this.cancelPaidFromAwaiting(order.id, 'Отменена клиентом после принятия');
      return;
    }

    throw new ConflictException('На этом этапе отмена недоступна');
  }

  private async cancelByMaster(order: Order): Promise<void> {
    // §3.9 + дизайн-дока §4: перезапуск поиска с волны 1, отменивший исключён
    // (его OrderOffer.outcome === 'ACCEPTED'); санкция мастеру — §3.9/этап 5.
    const masterUserId = order.masterId!;
    if(order.lifecycleVersion>=2 && order.status!=='ACCEPTED') throw new ConflictException('После выезда обратитесь в поддержку');
    await this.prisma.$transaction(async tx=>{
      const data={status:'SEARCHING' as const,masterId:null,acceptedAt:null,departedAt:null,onSiteAt:null,wave:0,searchAttempt:{increment:1}};
      if(order.lifecycleVersion>=2){
        const result=await tx.order.updateMany({where:{id:order.id,masterId:masterUserId,status:'ACCEPTED',departedAt:null},data});
        if(!result.count)throw new ConflictException('Заказ изменился; после выезда обратитесь в поддержку');
      }else{
        await this.gate(order.id,['ACCEPTED','MASTER_ON_WAY'],data,tx);
        await this.penalties.penalizeForCancellation(tx,masterUserId,'URGENT',order.id);
      }
    });
    await this.queue.send(order.lifecycleVersion>=2?JOBS.SEQUENTIAL_DISPATCH:JOBS.WAVE,order.lifecycleVersion>=2?{orderId:order.id,attempt:order.searchAttempt+1}:{ orderId: order.id, wave: 1 });
    await this.emitOrderStatus(order.id);
  }

  /** NO_MASTERS → SEARCHING: новый hold, новая попытка, волна 1. */
  async retrySearch(clientId: string, orderId: string): Promise<Order> {
    await this.guardClient(clientId, orderId);
    // Hold ставится до гейта: если гейт бросит 409 (статус уже не NO_MASTERS),
    // лишний HOLD останется висеть в mock-журнале — приемлемо для этапа 2
    // (реальный провайдер этапа 4 получит компенсирующий void).
    const current=await this.findOrThrow(orderId);
    if(current.lifecycleVersion<2) await this.payments.hold(orderId, current.calloutPrice);
    await this.gate(orderId, 'NO_MASTERS', {
      status: 'SEARCHING',
      wave: 0,
      searchAttempt: { increment: 1 },
    });
    await this.queue.send(current.lifecycleVersion>=2?JOBS.SEQUENTIAL_DISPATCH:JOBS.WAVE,current.lifecycleVersion>=2?{orderId,attempt:current.searchAttempt+1}:{orderId,wave:1});
    await this.emitOrderStatus(orderId);
    return this.findOrThrow(orderId);
  }
}
