import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AdminJournalController } from './admin-journal.controller';

@Module({
  providers: [AuditLogService],
  controllers: [AdminJournalController],
  exports: [AuditLogService],
})
export class AuditLogModule {}
