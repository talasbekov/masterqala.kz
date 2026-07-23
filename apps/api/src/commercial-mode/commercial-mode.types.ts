export const COMMERCIAL_MODES = ['FREE_PILOT', 'PAID_MOCK', 'PAID_LIVE'] as const;

export type CommercialMode = (typeof COMMERCIAL_MODES)[number];

export interface PublicCommercialConfig {
  commercialMode: CommercialMode;
  paymentsEnabled: boolean;
  leadCreditsEnabled: boolean;
  payoutsEnabled: boolean;
}
