import { Module } from '@nestjs/common';
import { MasterPenaltyService } from './master-penalty.service';

@Module({
  providers: [MasterPenaltyService],
  exports: [MasterPenaltyService],
})
export class CommonModule {}
