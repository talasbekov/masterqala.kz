import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { PaymentsModule } from '../payments/payments.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CommonModule } from '../common/common.module';
import { DisputesModule } from '../disputes/disputes.module';
import { StorageModule } from '../storage/storage.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MatchingService } from './matching.service';

@Module({
  imports: [PricingModule, PaymentsModule, RealtimeModule, CommonModule, DisputesModule, StorageModule, ReviewsModule],
  providers: [OrdersService, MatchingService],
  controllers: [OrdersController],
  exports: [OrdersService, MatchingService],
})
export class OrdersModule {}
