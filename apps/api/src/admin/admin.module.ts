import { Module } from '@nestjs/common';
import { HealthModule } from '../health.module';
import { StorageModule } from '../storage/storage.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { SecurityAuditController } from './security-audit.controller';
import { SecurityAuditService } from './security-audit.service';
import { SecurityAlertDeliveryService } from './security-alert-delivery.service';
import { SecurityObservabilityController } from './security-observability.controller';
import { SecurityObservabilityService } from './security-observability.service';

@Module({
  imports: [StorageModule, HealthModule, AuditLogModule],
  providers: [
    AdminService,
    SecurityAuditService,
    SecurityAlertDeliveryService,
    SecurityObservabilityService,
  ],
  controllers: [AdminController, SecurityAuditController, SecurityObservabilityController],
})
export class AdminModule {}
