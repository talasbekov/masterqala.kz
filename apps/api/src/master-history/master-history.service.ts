import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OrderStatus, PlannedOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Filter = 'all' | 'active' | 'history';
type Kind = 'urgent' | 'planned';
type Cursor = { v: 1; owner: string; filter: Filter; at: string; kind: Kind; id: string };
const urgentTerminal: OrderStatus[] = ['CLOSED', 'NO_MASTERS', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER'];
const plannedTerminal: PlannedOrderStatus[] = ['CLOSED', 'EXPIRED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER'];
const select = { id: true, status: true, district: true, createdAt: true, category: { select: { slug: true, name: true } } } as const;

@Injectable()
export class MasterHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(owner: string, query: Record<string, unknown> = {}) {
    // A master is represented by a profile, not by User.role (masters also have CLIENT role).
    // Former/inactive masters retain read access to their own assigned history.
    if (!await this.prisma.masterProfile.findUnique({ where: { userId: owner }, select: { id: true } })) {
      throw new ForbiddenException('Master profile required');
    }
    if (Object.keys(query).some(key => !['filter', 'limit', 'cursor'].includes(key))) throw new BadRequestException('Unknown query parameter');
    const filter = query.filter ?? 'all';
    if (filter !== 'all' && filter !== 'active' && filter !== 'history') throw new BadRequestException('Invalid filter');
    const limit = query.limit === undefined ? 20 : typeof query.limit === 'string' && /^\d{1,2}$/.test(query.limit) ? Number(query.limit) : NaN;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException('Limit must be 1 to 50');
    const cursor = query.cursor === undefined ? null : this.decode(query.cursor, owner, filter);
    const after = (kind: Kind) => cursor ? { OR: [
      { createdAt: { lt: new Date(cursor.at) } },
      ...(kind > cursor.kind ? [{ createdAt: new Date(cursor.at) }] : kind === cursor.kind ? [{ createdAt: new Date(cursor.at), id: { lt: cursor.id } }] : []),
    ] } : {};
    const [urgent, planned] = await Promise.all([
      this.prisma.order.findMany({ where: { masterId: owner, ...after('urgent'), ...(filter === 'all' ? {} : { status: filter === 'history' ? { in: urgentTerminal } : { notIn: urgentTerminal } }) }, select, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 }),
      this.prisma.plannedOrder.findMany({ where: { masterId: owner, lifecycleModel: 'LEGACY', ...after('planned'), ...(filter === 'all' ? {} : { status: filter === 'history' ? { in: plannedTerminal } : { notIn: plannedTerminal } }) }, select, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 }),
    ]);
    const merged = [...urgent.map(row => ({ ...row, kind: 'urgent' as const })), ...planned.map(row => ({ ...row, kind: 'planned' as const }))]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
    const items = merged.slice(0, limit);
    const last = items.at(-1);
    const nextCursor = merged.length > limit && last ? Buffer.from(JSON.stringify({ v: 1, owner, filter, at: last.createdAt.toISOString(), kind: last.kind, id: last.id } satisfies Cursor)).toString('base64url') : null;
    return { items, nextCursor };
  }

  private decode(raw: unknown, owner: string, filter: Filter): Cursor {
    try {
      if (typeof raw !== 'string' || raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error();
      const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      if (value.v !== 1 || value.owner !== owner || value.filter !== filter || !['urgent', 'planned'].includes(value.kind) || typeof value.id !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(value.id) || typeof value.at !== 'string' || new Date(value.at).toISOString() !== value.at) throw new Error();
      return value;
    } catch { throw new BadRequestException('Invalid cursor'); }
  }
}
