import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PresenceService } from './presence.service';

interface GeoPayload {
  lat: number;
  lng: number;
}

@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
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
  }

  emitToUser(userId: string, event: string, payload: object): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
