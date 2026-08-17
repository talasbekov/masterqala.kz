import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { PaymentsModule } from '../payments/payments.module';
import { CommonModule } from '../common/common.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { AdminDisputesController } from './admin-disputes.controller';

@Module({
  imports: [StorageModule, PaymentsModule, CommonModule, AuditLogModule],
  providers: [DisputesService],
  controllers: [DisputesController, AdminDisputesController],
  exports: [DisputesService],
})
export class DisputesModule {}
