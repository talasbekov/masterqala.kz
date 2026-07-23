import { Module } from '@nestjs/common';
import { CommercialModeModule } from '../commercial-mode/commercial-mode.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CommonModule } from '../common/common.module';
import { DisputesModule } from '../disputes/disputes.module';
import { StorageModule } from '../storage/storage.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { PlannedOrdersService } from './planned-orders.service';
import { PlannedOrdersCommercialService } from './planned-orders-commercial.service';
import { PlannedOrdersController } from './planned-orders.controller';

@Module({
  imports: [CommercialModeModule, RealtimeModule, CommonModule, DisputesModule, StorageModule, ReviewsModule],
  providers: [PlannedOrdersService, PlannedOrdersCommercialService],
  controllers: [PlannedOrdersController],
  exports: [PlannedOrdersService],
})
export class PlannedOrdersModule {}
