import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { CommonModule } from '../common/common.module';
import { DisputesModule } from '../disputes/disputes.module';
import { StorageModule } from '../storage/storage.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { PlannedOrdersService } from './planned-orders.service';
import { PlannedOrdersController } from './planned-orders.controller';

@Module({
  imports: [RealtimeModule, CommonModule, DisputesModule, StorageModule, ReviewsModule],
  providers: [PlannedOrdersService],
  controllers: [PlannedOrdersController],
  exports: [PlannedOrdersService],
})
export class PlannedOrdersModule {}
