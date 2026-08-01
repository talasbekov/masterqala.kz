import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVE_CLIENT_STATUSES } from '../orders/order.constants';

@Injectable()
export class AdminMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const since = new Date(Date.now() - 24 * 3600_000);
    const nonTerminalStatuses = ACTIVE_CLIENT_STATUSES.filter((s) => s !== 'NO_MASTERS' && s !== 'DONE');

    const [
      activeUrgentCount,
      publishedPlannedCount,
      openDisputesCount,
      pendingVerificationCount,
      pendingWithdrawalsCount,
      [{ accepted, noMasters }],
      [{ median }],
      stuckOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where: { status: { in: nonTerminalStatuses as any } } }),
      this.prisma.plannedOrder.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.dispute.count({ where: { status: 'OPEN' } }),
      this.prisma.masterProfile.count({ where: { status: { in: ['PENDING_REVIEW', 'NEEDS_INFO'] } } }),
      this.prisma.withdrawalRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.$queryRaw<{ accepted: bigint; noMasters: bigint }[]>`
        SELECT
          count(*) FILTER (WHERE "acceptedAt" IS NOT NULL) AS accepted,
          count(*) FILTER (WHERE status = 'NO_MASTERS') AS "noMasters"
        FROM "Order"
        WHERE "createdAt" >= ${since}`,
      this.prisma.$queryRaw<{ median: number | null }[]>`
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM "acceptedAt" - "createdAt")) AS median
        FROM "Order"
        WHERE "acceptedAt" IS NOT NULL AND "createdAt" >= ${since}`,
      this.prisma.order.findMany({
        where: { status: 'SEARCHING', wave: 3, createdAt: { lt: new Date(Date.now() - 5 * 60_000) } },
        include: { category: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
    ]);
    const totalDecided = Number(accepted) + Number(noMasters);
    const foundMasterRate = totalDecided === 0 ? null : Math.round((Number(accepted) / totalDecided) * 100);

    return {
      activeUrgentCount,
      publishedPlannedCount,
      foundMasterRate,
      medianSearchSeconds: median === null ? null : Math.round(Number(median)),
      openDisputesCount,
      pendingVerificationCount,
      pendingWithdrawalsCount,
      stuckSearches: stuckOrders.map((o) => ({
        id: o.id,
        category: o.category.name,
        address: o.address,
        wave: o.wave,
        waitingSeconds: Math.round((Date.now() - o.createdAt.getTime()) / 1000),
      })),
    };
  }
}
