export interface LeadCreditPackage {
  id: string;
  credits: number;
  priceTenge: number;
}

export const LEAD_CREDIT_PACKAGES: LeadCreditPackage[] = [
  { id: 'single', credits: 1, priceTenge: 500 },
  { id: 'start', credits: 10, priceTenge: 5000 },
  { id: 'standard', credits: 25, priceTenge: 11000 },
  { id: 'pro', credits: 60, priceTenge: 24000 },
];
