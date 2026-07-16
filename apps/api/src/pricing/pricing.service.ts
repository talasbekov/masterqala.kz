import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  LatLng,
  ROUTING_SERVICE,
  RoutingService,
} from '../routing/routing.interface';
import { PricingConfig } from './pricing.config';
import { ACTIVE_MASTER_STATUSES } from '../orders/order.constants';

export const MAX_SEARCH_RADIUS_M = 10000;

export interface PriceQuote {
  calloutPrice: number;
  serviceFee: number;
  distanceKm: number;
  coefficient: number;
}

export function computeTimeCoefficient(now: Date): number {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Almaty',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  );
  if (hour >= 8 && hour < 20) return 1.0;
  if (hour >= 20 && hour < 23) return 1.2;
  return 1.5;
}

export function calcPrices(
  cfg: Pick<PricingConfig, 'baseFare' | 'perKm' | 'feeRate' | 'feeMin'>,
  distanceKm: number,
  coefficient: number,
): { calloutPrice: number; serviceFee: number } {
  const calloutPrice = Math.round(
    (cfg.baseFare + distanceKm * cfg.perKm) * coefficient,
  );
  const serviceFee = Math.max(
    Math.round(calloutPrice * cfg.feeRate),
    cfg.feeMin,
  );
  return { calloutPrice, serviceFee };
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: PricingConfig,
    @Inject(ROUTING_SERVICE) private readonly routing: RoutingService,
  ) {}

  async quote(
    categoryId: string,
    to: LatLng,
    clientId: string,
    now: Date = new Date(),
  ): Promise<PriceQuote | null> {
    const nearest = await this.findNearestFreeMaster(categoryId, to, clientId);
    if (!nearest) return null;
    const distanceKm = await this.routing.distanceKm(nearest, to);
    const coefficient = computeTimeCoefficient(now);
    return {
      ...calcPrices(this.cfg, distanceKm, coefficient),
      distanceKm,
      coefficient,
    };
  }

  private async findNearestFreeMaster(
    categoryId: string,
    to: LatLng,
    clientId: string,
  ): Promise<LatLng | null> {
    const activeStatuses = Prisma.join(
      ACTIVE_MASTER_STATUSES.map((s) => Prisma.sql`${s}::"OrderStatus"`),
    );
    const rows = await this.prisma.$queryRaw<{ lat: number; lng: number }[]>`
      SELECT ST_Y(mp.location::geometry) AS lat, ST_X(mp.location::geometry) AS lng
      FROM "MasterPresence" mp
      JOIN "MasterProfile" pr ON pr."userId" = mp."masterUserId" AND pr.status = 'ACTIVE'
      JOIN "MasterCategory" mc ON mc."masterProfileId" = pr.id AND mc."categoryId" = ${categoryId}
      WHERE mp."isOnline" = true AND mp.location IS NOT NULL
        AND mp."masterUserId" <> ${clientId}
        AND ST_DWithin(mp.location, ST_SetSRID(ST_MakePoint(${to.lng}, ${to.lat}), 4326)::geography, ${MAX_SEARCH_RADIUS_M})
        AND NOT EXISTS (
          SELECT 1 FROM "Order" ao
          WHERE ao."masterId" = mp."masterUserId"
            AND ao.status IN (${activeStatuses})
        )
      ORDER BY ST_Distance(mp.location, ST_SetSRID(ST_MakePoint(${to.lng}, ${to.lat}), 4326)::geography)
      LIMIT 1`;
    return rows[0] ?? null;
  }
}
