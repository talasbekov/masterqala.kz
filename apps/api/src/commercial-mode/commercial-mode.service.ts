import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { COMMERCIAL_MODES, CommercialMode, PublicCommercialConfig } from './commercial-mode.types';

@Injectable()
export class CommercialModeService {
  private readonly currentMode: CommercialMode;

  constructor(config: ConfigService) {
    const configured = config.get<string>('COMMERCIAL_MODE') ?? 'PAID_MOCK';
    if (!COMMERCIAL_MODES.includes(configured as CommercialMode)) {
      throw new Error(
        `Недопустимый COMMERCIAL_MODE=${configured}. Допустимые значения: ${COMMERCIAL_MODES.join(', ')}`,
      );
    }
    this.currentMode = configured as CommercialMode;
  }

  mode(): CommercialMode {
    return this.currentMode;
  }

  isFreePilot(): boolean {
    return this.currentMode === 'FREE_PILOT';
  }

  paymentsEnabled(): boolean {
    return !this.isFreePilot();
  }

  leadCreditsEnabled(): boolean {
    return !this.isFreePilot();
  }

  payoutsEnabled(): boolean {
    return !this.isFreePilot();
  }

  publicConfig(): PublicCommercialConfig {
    return {
      commercialMode: this.mode(),
      paymentsEnabled: this.paymentsEnabled(),
      leadCreditsEnabled: this.leadCreditsEnabled(),
      payoutsEnabled: this.payoutsEnabled(),
    };
  }
}
