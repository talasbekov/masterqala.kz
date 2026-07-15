import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PricingConfig {
  readonly baseFare: number;
  readonly perKm: number;
  readonly feeRate: number;
  readonly feeMin: number;

  constructor(config: ConfigService) {
    this.baseFare = Number(config.get('PRICING_BASE_FARE') ?? 2000);
    this.perKm = Number(config.get('PRICING_PER_KM') ?? 150);
    this.feeRate = Number(config.get('SERVICE_FEE_RATE') ?? 0.4);
    this.feeMin = Number(config.get('SERVICE_FEE_MIN') ?? 1000);
  }
}
