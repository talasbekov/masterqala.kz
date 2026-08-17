import { Module } from '@nestjs/common';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminMetricsController } from './admin-metrics.controller';

@Module({
  providers: [AdminMetricsService],
  controllers: [AdminMetricsController],
})
export class AdminMetricsModule {}
