import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OrderStatus } from '@prisma/client';
import { PresenceService } from './presence.service';
import { PrismaService } from '../prisma/prisma.service';
import { PostgisRoutingService } from '../routing/postgis-routing.service';
import { estimateEtaMinutes } from '../routing/eta';

interface GeoPayload {
  lat: number;
  lng: number;
}

const URGENT_EN_ROUTE_STATUSES: OrderStatus[] = ['ACCEPTED', 'MASTER_ON_WAY'];

@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server): void {
    // Отклоняем невалидный JWT ещё в handshake — клиент получает connect_error.
    server.use(async (socket, next) => {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(socket.handshake.auth?.token ?? '');
        socket.data.userId = payload.sub;
        await socket.join(`user:${payload.sub}`);
        next();
      } catch {
        next(new Error('Требуется вход'));
      }
    });
    server.on('connection', (socket) => {
      socket.on('disconnect', () => {
        if (socket.data.userId) void this.presence.setOffline(socket.data.userId);
      });
    });
  }

  @SubscribeMessage('presence:online')
  async onOnline(@ConnectedSocket() socket: Socket, @MessageBody() body: GeoPayload): Promise<void> {
    if (typeof body?.lat !== 'number' || typeof body?.lng !== 'number') return;
    await this.presence.setOnline(socket.data.userId, body.lat, body.lng);
  }

  @SubscribeMessage('presence:offline')
  async onOffline(@ConnectedSocket() socket: Socket): Promise<void> {
    await this.presence.setOffline(socket.data.userId);
  }

  @SubscribeMessage('geo:update')
  async onGeo(@ConnectedSocket() socket: Socket, @MessageBody() body: GeoPayload): Promise<void> {
    if (typeof body?.lat !== 'number' || typeof body?.lng !== 'number') return;
    await this.presence.updateGeo(socket.data.userId, body.lat, body.lng);
    await this.relayToActiveOrder(socket.data.userId, body.lat, body.lng);
  }

  emitToUser(userId: string, event: string, payload: object): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  /** Мастер с активной срочной заявкой (едет) — шлём его позицию + ETA клиенту заявки. */
  private async relayToActiveOrder(masterUserId: string, lat: number, lng: number): Promise<void> {
    const order = await this.prisma.order.findFirst({
      where: { masterId: masterUserId, status: { in: URGENT_EN_ROUTE_STATUSES } },
    });
    if (!order) return;
    const etaMinutes = await this.etaTo(lat, lng, order.id);
    this.emitToUser(order.clientId, 'master:location', { orderId: order.id, lat, lng, etaMinutes });
  }

  private async etaTo(lat: number, lng: number, orderId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ m: number }[]>`
      SELECT ST_Distance(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, location) AS m
      FROM "Order" WHERE id = ${orderId} AND location IS NOT NULL`;
    if (!rows[0]) return 0;
    const distanceKm = (rows[0].m / 1000) * PostgisRoutingService.ROAD_FACTOR;
    return estimateEtaMinutes(distanceKm);
  }
}
