import { Module } from '@nestjs/common';
import { ROUTING_SERVICE } from './routing.interface';
import { PostgisRoutingService } from './postgis-routing.service';

@Module({
  providers: [{ provide: ROUTING_SERVICE, useClass: PostgisRoutingService }],
  exports: [ROUTING_SERVICE],
})
export class RoutingModule {}
