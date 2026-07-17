import { Module } from '@nestjs/common';
import { RoutingModule } from '../routing/routing.module';
import { PricingConfig } from './pricing.config';
import { PricingService } from './pricing.service';

@Module({
  imports: [RoutingModule],
  providers: [PricingConfig, PricingService],
  exports: [PricingService],
})
export class PricingModule {}
