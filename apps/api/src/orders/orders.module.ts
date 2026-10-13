import { Module } from '@nestjs/common';
import { CommercialModeModule } from '../commercial-mode/commercial-mode.module';
import { PricingModule } from '../pricing/pricing.module';
import { PaymentsModule } from '../payments/payments.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CommonModule } from '../common/common.module';
import { DisputesModule } from '../disputes/disputes.module';
import { StorageModule } from '../storage/storage.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import {OrderCreationRequestService} from './order-creation-request.service';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { DirectOrderLifecycleService } from './direct-order-lifecycle.service';
import { SequentialMatchingService } from './sequential-matching.service';
import { MatchingService } from './matching.service';

@Module({
  imports: [
    CommercialModeModule,
    PricingModule,
    PaymentsModule,
    RealtimeModule,
    CommonModule,
    DisputesModule,
    StorageModule,
    ReviewsModule,
    AuditLogModule,
  ],
  providers: [OrderCreationRequestService, OrdersService, MatchingService, SequentialMatchingService, DirectOrderLifecycleService],
  controllers: [OrdersController],
  exports: [OrdersService, MatchingService],
})
export class OrdersModule {}
