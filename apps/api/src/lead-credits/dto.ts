import { IsIn } from 'class-validator';
import { LEAD_CREDIT_PACKAGES } from './lead-credits.config';

export class PurchaseLeadCreditsDto {
  @IsIn(LEAD_CREDIT_PACKAGES.map((p) => p.id))
  package!: string;
}
