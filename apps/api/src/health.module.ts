import { Module } from '@nestjs/common';
import { StorageModule } from './storage/storage.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SecurityDependencyMonitorService } from './security-dependency-monitor.service';

@Module({
  imports: [StorageModule],
  controllers: [HealthController],
  providers: [HealthService, SecurityDependencyMonitorService],
  exports: [HealthService],
})
export class HealthModule {}
