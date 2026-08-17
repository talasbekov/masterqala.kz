import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PlannedOrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_MASTER_STATUSES } from '../orders/order.constants';

const ORDER_STATUSES = new Set<string>(Object.values(OrderStatus));
const PLANNED_ORDER_STATUSES = new Set<string>(Object.values(PlannedOrderStatus));

export interface AssignCandidate {
  masterUserId: string;
  name: string;
  distanceKm: number;
  isOnline: boolean;
}

const ACTIVE_MASTER_STATUSES_SQL = Prisma.join(
  ACTIVE_MASTER_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`),
);

export interface AdminOrderRow {
  id: string;
  type: 'urgent' | 'planned';
  client: string;
  master: string | null;
  category: string;
  status: string;
  createdAt: Date;
}

export interface TimelineEntry {
  at: Date;
  event: string;
}

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { type?: 'urgent' | 'planned'; status?: string; search?: string }): Promise<AdminOrderRow[]> {
    const searchFilter = opts.search
      ? [{ id: { startsWith: opts.search } }, { client: { phone: { contains: opts.search } } }]
      : undefined;

    // status может относиться только к одному из двух enum'ов (фронт сводит их в
    // один общий dropdown при типе "все типы") — если он не входит в enum текущей
    // ветки, эта ветка не может вернуть ни одной строки, а не 500 от Prisma.
    const statusInvalidForOrder = opts.status !== undefined && !ORDER_STATUSES.has(opts.status);
    const statusInvalidForPlanned = opts.status !== undefined && !PLANNED_ORDER_STATUSES.has(opts.status);

    const [orders, planned] = await Promise.all([
      opts.type !== 'planned' && !statusInvalidForOrder
        ? this.prisma.order.findMany({
            where: { status: opts.status as OrderStatus | undefined, OR: searchFilter },
            include: { client: true, master: true, category: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
      opts.type !== 'urgent' && !statusInvalidForPlanned
        ? this.prisma.plannedOrder.findMany({
            where: { status: opts.status as PlannedOrderStatus | undefined, OR: searchFilter },
            include: { client: true, master: true, category: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
    ]);

    const rows: AdminOrderRow[] = [
      ...orders.map((o) => ({
        id: o.id,
        type: 'urgent' as const,
        client: o.client.name ?? o.client.phone,
        master: o.master ? o.master.name ?? o.master.phone : null,
        category: o.category.name,
        status: o.status,
        createdAt: o.createdAt,
      })),
      ...planned.map((o) => ({
        id: o.id,
        type: 'planned' as const,
        client: o.client.name ?? o.client.phone,
        master: o.master ? o.master.name ?? o.master.phone : null,
        category: o.category.name,
        status: o.status,
        createdAt: o.createdAt,
      })),
    ];

    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 100);
  }

  async candidates(orderId: string, type: 'urgent' | 'planned' = 'urgent'): Promise<AssignCandidate[]> {
    if (type === 'planned') {
      throw new BadRequestException('Подбор кандидатов недоступен для плановых заказов');
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден');

    const rows = await this.prisma.$queryRaw<{ id: string; name: string | null; meters: number }[]>`
      SELECT u.id, u.name, ST_Distance(mp.location, o.location) AS meters
      FROM "MasterPresence" mp
      JOIN "User" u ON u.id = mp."masterUserId"
      JOIN "MasterProfile" pr ON pr."userId" = u.id AND pr.status = 'ACTIVE'
      JOIN "MasterCategory" mc ON mc."masterProfileId" = pr.id AND mc."categoryId" = ${order.categoryId}
      JOIN "Order" o ON o.id = ${orderId}
      WHERE mp."isOnline" = true
        -- см. matching.service.ts: блокировка оператором живёт в User.isBlocked
        AND u."isBlocked" = false
        AND (pr."blockedUntil" IS NULL OR pr."blockedUntil" < now())
        AND mp.location IS NOT NULL AND o.location IS NOT NULL
        AND u.id <> ${order.clientId}
        AND NOT EXISTS (
          SELECT 1 FROM "Order" ao WHERE ao."masterId" = u.id AND ao.status IN (${ACTIVE_MASTER_STATUSES_SQL})
        )
      ORDER BY meters ASC
      LIMIT 10`;

    return rows.map((r) => ({
      masterUserId: r.id,
      name: r.name ?? '—',
      distanceKm: Math.round(r.meters / 100) / 10,
      isOnline: true,
    }));
  }

  async detail(id: string, type: 'urgent' | 'planned') {
    if (type === 'planned') return this.plannedDetail(id);
    return this.urgentDetail(id);
  }

  private async urgentDetail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { client: true, master: true, category: true, disputes: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const timeline: TimelineEntry[] = [
      { at: order.createdAt, event: `создана · выезд ${order.calloutPrice} ₸` },
      ...(order.acceptedAt ? [{ at: order.acceptedAt, event: `принял ${order.master?.name ?? order.master?.phone}` }] : []),
      ...(order.priceProposedAt ? [{ at: order.priceProposedAt, event: 'цена предложена клиенту' }] : []),
      ...(order.completedAt ? [{ at: order.completedAt, event: 'выполнено' }] : []),
      ...(order.closedAt ? [{ at: order.closedAt, event: 'закрыта' }] : []),
      ...order.disputes.map((d) => ({ at: d.createdAt, event: `открыт спор #${d.id}` })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    const canAssign =
      order.status === 'SEARCHING' && order.wave === 3 && Date.now() - order.createdAt.getTime() > 5 * 60_000;

    return {
      id: order.id,
      type: 'urgent' as const,
      status: order.status,
      address: order.address,
      district: order.district,
      createdAt: order.createdAt,
      client: { name: order.client.name, phone: order.client.phone },
      master: order.master ? { name: order.master.name, phone: order.master.phone } : null,
      category: order.category.name,
      calloutPrice: order.calloutPrice,
      serviceFee: order.serviceFee,
      workPrice: order.workPrice,
      timeline,
      canAssign,
    };
  }

  private async plannedDetail(id: string) {
    const order = await this.prisma.plannedOrder.findUnique({
      where: { id },
      include: { client: true, master: true, category: true, disputes: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');

    const timeline: TimelineEntry[] = [
      { at: order.createdAt, event: 'создана' },
      ...(order.publishedAt ? [{ at: order.publishedAt, event: 'опубликована' }] : []),
      ...(order.selectedAt ? [{ at: order.selectedAt, event: `выбран ${order.master?.name ?? order.master?.phone}` }] : []),
      ...(order.confirmedAt ? [{ at: order.confirmedAt, event: 'подтверждена мастером' }] : []),
      ...(order.completedAt ? [{ at: order.completedAt, event: 'выполнено' }] : []),
      ...(order.closedAt ? [{ at: order.closedAt, event: 'закрыта' }] : []),
      ...order.disputes.map((d) => ({ at: d.createdAt, event: `открыт спор #${d.id}` })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    return {
      id: order.id,
      type: 'planned' as const,
      status: order.status,
      address: order.address,
      district: order.district,
      createdAt: order.createdAt,
      client: { name: order.client.name, phone: order.client.phone },
      master: order.master ? { name: order.master.name, phone: order.master.phone } : null,
      category: order.category.name,
      budget: order.budget,
      workPrice: order.workPrice,
      timeline,
      canAssign: false,
    };
  }
}
