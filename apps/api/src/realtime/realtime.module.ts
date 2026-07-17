import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  providers: [PresenceService, RealtimeGateway],
  exports: [PresenceService, RealtimeGateway],
})
export class RealtimeModule {}
