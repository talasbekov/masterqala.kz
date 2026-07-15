import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LatLng, RoutingService } from './routing.interface';

@Injectable()
export class PostgisRoutingService implements RoutingService {
  /** Приближение «по дорогам»: прямая × 1.3 (реальный 2ГИС/Google — позже). */
  static readonly ROAD_FACTOR = 1.3;

  constructor(private readonly prisma: PrismaService) {}

  async distanceKm(from: LatLng, to: LatLng): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ m: number }[]>`
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint(${from.lng}, ${from.lat}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${to.lng}, ${to.lat}), 4326)::geography
      ) AS m`;
    return (rows[0].m / 1000) * PostgisRoutingService.ROAD_FACTOR;
  }
}
