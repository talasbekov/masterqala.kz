import { ConfigService } from '@nestjs/config';
import { PricingConfig } from './pricing.config';

function cfg(env: Record<string, string>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

describe('PricingConfig', () => {
  it('принимает feeMin меньше baseFare', () => {
    const c = new PricingConfig(cfg({ PRICING_BASE_FARE: '2000', SERVICE_FEE_MIN: '1000' }));
    expect(c.baseFare).toBe(2000);
    expect(c.feeMin).toBe(1000);
  });

  it('падает при SERVICE_FEE_MIN >= PRICING_BASE_FARE (иначе компенсация мастеру уходит в ноль/минус)', () => {
    expect(() => new PricingConfig(cfg({ PRICING_BASE_FARE: '2000', SERVICE_FEE_MIN: '2000' }))).toThrow();
    expect(() => new PricingConfig(cfg({ PRICING_BASE_FARE: '2000', SERVICE_FEE_MIN: '3000' }))).toThrow();
  });
});
