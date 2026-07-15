import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { PaymentsModule } from '../payments/payments.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [PricingModule, PaymentsModule, RealtimeModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
