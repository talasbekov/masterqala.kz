import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { CommonModule } from '../common/common.module';
import { PlannedOrdersService } from './planned-orders.service';
import { PlannedOrdersController } from './planned-orders.controller';

@Module({
  imports: [RealtimeModule, CommonModule],
  providers: [PlannedOrdersService],
  controllers: [PlannedOrdersController],
  exports: [PlannedOrdersService],
})
export class PlannedOrdersModule {}
