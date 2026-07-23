import { Module } from '@nestjs/common';
import { CommercialModeModule } from '../commercial-mode/commercial-mode.module';
import { PaymentsModule } from '../payments/payments.module';
import { LeadCreditsService } from './lead-credits.service';
import { LeadCreditsController } from './lead-credits.controller';

@Module({
  imports: [CommercialModeModule, PaymentsModule],
  providers: [LeadCreditsService],
  controllers: [LeadCreditsController],
  exports: [LeadCreditsService],
})
export class LeadCreditsModule {}
