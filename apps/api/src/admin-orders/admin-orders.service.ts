import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    const rows: AdminOrderRow[] = [];
    const searchFilter = opts.search
      ? [{ id: { startsWith: opts.search } }, { client: { phone: { contains: opts.search } } }]
      : undefined;

    if (opts.type !== 'planned') {
      const orders = await this.prisma.order.findMany({
        where: { status: opts.status as any, OR: searchFilter },
        include: { client: true, master: true, category: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      rows.push(
        ...orders.map((o) => ({
          id: o.id,
          type: 'urgent' as const,
          client: o.client.name ?? o.client.phone,
          master: o.master ? o.master.name ?? o.master.phone : null,
          category: o.category.name,
          status: o.status,
          createdAt: o.createdAt,
        })),
      );
    }

    if (opts.type !== 'urgent') {
      const planned = await this.prisma.plannedOrder.findMany({
        where: { status: opts.status as any, OR: searchFilter },
        include: { client: true, master: true, category: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      rows.push(
        ...planned.map((o) => ({
          id: o.id,
          type: 'planned' as const,
          client: o.client.name ?? o.client.phone,
          master: o.master ? o.master.name ?? o.master.phone : null,
          category: o.category.name,
          status: o.status,
          createdAt: o.createdAt,
        })),
      );
    }

    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 100);
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
