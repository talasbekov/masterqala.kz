import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PostgisRoutingService } from '../routing/postgis-routing.service';
import { OrdersService } from './orders.service';
import { ACTIVE_MASTER_STATUSES, MAX_WAVE, WAVE_RADII_M, WAVE_TIMEOUTS_S } from './order.constants';

const ACTIVE_MASTER_STATUSES_SQL = Prisma.join(
  ACTIVE_MASTER_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`),
);

interface WaveJob {
  orderId: string;
  wave: number;
}

interface WaveTimeoutJob extends WaveJob {
  attempt: number;
}

interface Candidate {
  id: string;
  meters: number;
}

@Injectable()
export class MatchingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly gateway: RealtimeGateway,
    private readonly orders: OrdersService,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.WAVE, (d: WaveJob) => this.handleWave(d));
    this.queue.register(JOBS.WAVE_TIMEOUT, (d: WaveTimeoutJob) => this.handleWaveTimeout(d));
  }

  async handleWave({ orderId, wave }: WaveJob): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { category: true } });
    if (!order || order.status !== 'SEARCHING') return;

    const candidates = await this.findCandidates(orderId, order.categoryId, order.clientId, order.searchAttempt, WAVE_RADII_M[wave - 1]);
    if (candidates.length === 0) {
      // Прежде чем эскалировать/сдаваться, проверяем, что эту волну ещё не обогнал
      // другой конкурентный вызов (например, тот, что уже создал офферы для wave):
      // если order.wave уже >= wave, значит другой вызов победил гонку — этот
      // no-op, не эскалируем и не гасим чужие офферы.
      const fresh = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!fresh || fresh.status !== 'SEARCHING' || fresh.wave >= wave) return;
      if (wave < MAX_WAVE) return this.handleWave({ orderId, wave: wave + 1 });
      return this.orders.markNoMasters(orderId);
    }

    // Гейт с монотонной защитой: wave может двигаться только вперёд (wave: {lt: wave}).
    // Если 0 строк обновлено — эту волну уже обогнал другой вызов (redelivery джобы
    // pg-boss или гонка recursive-эскалации), выходим без создания офферов,
    // планирования таймаута и WS — легитимный no-op, не ошибка.
    const won = await this.prisma.$transaction(async (tx) => {
      const gate = await tx.order.updateMany({
        where: { id: orderId, status: 'SEARCHING', wave: { lt: wave } },
        data: { wave },
      });
      if (gate.count === 0) return false;
      await tx.orderOffer.createMany({
        data: candidates.map((c) => ({ orderId, masterUserId: c.id, wave, attempt: order.searchAttempt })),
        skipDuplicates: true,
      });
      return true;
    });
    if (!won) return;

    const timeoutS = WAVE_TIMEOUTS_S[wave - 1];
    const deadline = new Date(Date.now() + timeoutS * 1000).toISOString();
    const compensation = order.calloutPrice - order.serviceFee;
    for (const c of candidates) {
      this.gateway.emitToUser(c.id, 'offer:new', {
        orderId,
        category: order.category.name,
        description: order.description,
        address: order.address,
        distanceKm: Math.round((c.meters / 1000) * PostgisRoutingService.ROAD_FACTOR * 10) / 10,
        compensation,
        deadline,
        wave,
      });
    }
    await this.queue.send(JOBS.WAVE_TIMEOUT, { orderId, wave, attempt: order.searchAttempt }, timeoutS);
    await this.orders.emitOrderStatus(orderId); // клиенту — «расширяем радиус»
  }

  async handleWaveTimeout({ orderId, wave, attempt }: WaveTimeoutJob): Promise<void> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'SEARCHING' || order.searchAttempt !== attempt || order.wave !== wave) return;

    const expired = await this.prisma.orderOffer.findMany({
      where: { orderId, wave, attempt, outcome: 'PENDING' },
    });
    await this.prisma.orderOffer.updateMany({
      where: { id: { in: expired.map((o) => o.id) } },
      data: { outcome: 'EXPIRED' },
    });
    for (const o of expired) {
      this.gateway.emitToUser(o.masterUserId, 'offer:closed', { orderId, reason: 'Время на принятие истекло' });
    }
    if (wave < MAX_WAVE) return this.handleWave({ orderId, wave: wave + 1 });
    return this.orders.markNoMasters(orderId);
  }

  /** Кандидаты волны: ACTIVE-профиль, онлайн, в радиусе, категория, свободен, без оффера в этой попытке, не отменял эту заявку. */
  private async findCandidates(
    orderId: string,
    categoryId: string,
    clientId: string,
    attempt: number,
    radiusM: number,
  ): Promise<Candidate[]> {
    return this.prisma.$queryRaw<Candidate[]>`
      SELECT u.id, ST_Distance(mp.location, o.location) AS meters
      FROM "MasterPresence" mp
      JOIN "User" u ON u.id = mp."masterUserId"
      JOIN "MasterProfile" pr ON pr."userId" = u.id AND pr.status = 'ACTIVE'
      JOIN "MasterCategory" mc ON mc."masterProfileId" = pr.id AND mc."categoryId" = ${categoryId}
      JOIN "Order" o ON o.id = ${orderId}
      WHERE mp."isOnline" = true
        AND (pr."blockedUntil" IS NULL OR pr."blockedUntil" < now())
        AND mp.location IS NOT NULL
        AND o.location IS NOT NULL
        AND u.id <> ${clientId}
        AND ST_DWithin(mp.location, o.location, ${radiusM})
        AND NOT EXISTS (
          SELECT 1 FROM "Order" ao
          WHERE ao."masterId" = u.id
            AND ao.status IN (${ACTIVE_MASTER_STATUSES_SQL})
        )
        AND NOT EXISTS (
          SELECT 1 FROM "OrderOffer" oo
          WHERE oo."orderId" = ${orderId} AND oo."masterUserId" = u.id
            AND (oo.attempt = ${attempt} OR oo.outcome = 'ACCEPTED')
        )
      ORDER BY meters ASC`;
  }
}
