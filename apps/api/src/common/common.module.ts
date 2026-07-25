import { Module } from '@nestjs/common';
import { CommercialModeModule } from '../commercial-mode/commercial-mode.module';
import { MasterPenaltyService } from './master-penalty.service';
import { CompensationService } from './compensation.service';

@Module({
  imports: [CommercialModeModule],
  providers: [MasterPenaltyService, CompensationService],
  exports: [MasterPenaltyService, CompensationService],
})
export class CommonModule {}
