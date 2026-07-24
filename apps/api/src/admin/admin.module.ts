import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SecurityAuditController } from './security-audit.controller';
import { SecurityAuditService } from './security-audit.service';

@Module({
  imports: [StorageModule],
  providers: [AdminService, SecurityAuditService],
  controllers: [AdminController, SecurityAuditController],
})
export class AdminModule {}
