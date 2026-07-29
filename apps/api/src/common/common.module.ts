import { Module } from '@nestjs/common';
import { CommercialModeModule } from '../commercial-mode/commercial-mode.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MasterPenaltyService } from './master-penalty.service';
import { CompensationService } from './compensation.service';

@Module({
  imports: [CommercialModeModule, AuditLogModule],
  providers: [MasterPenaltyService, CompensationService],
  exports: [MasterPenaltyService, CompensationService],
})
export class CommonModule {}
