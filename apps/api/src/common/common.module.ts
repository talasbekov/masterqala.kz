import { Module } from '@nestjs/common';
import { MasterPenaltyService } from './master-penalty.service';
import { CompensationService } from './compensation.service';

@Module({
  providers: [MasterPenaltyService, CompensationService],
  exports: [MasterPenaltyService, CompensationService],
})
export class CommonModule {}
