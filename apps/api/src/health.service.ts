import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { QueueService } from './queue/queue.service';
import {
  QUARANTINE_SCANNER,
  QuarantineScanner,
  ScannerHealth,
} from './storage/quarantine-scanner.interface';

type DependencyStatus =
  | { status: 'UP'; latencyMs: number }
  | { status: 'DOWN'; latencyMs: number; error: string };

type BacklogRow = {
  pendingScans: bigint;
  failedScans: bigint;
  staleScanning: bigint;
  openCriticalAlerts: bigint;
  openHighAlerts: bigint;
};

@Injectable()
export class HealthService {
  private readonly nodeEnv: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
    @Inject(QUARANTINE_SCANNER) private readonly scanner: QuarantineScanner,
  ) {
    this.nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
  }

  async readiness() {
    const [database, scanner, backlog] = await Promise.all([
      this.databaseHealth(),
      this.scannerHealth(),
      this.backlog(),
    ]);
    const queue = this.queue.healthCheck();

    const queueReady = queue.status === 'UP' || (queue.status === 'DISABLED' && this.nodeEnv !== 'production');
    const scannerReady = scanner.status === 'UP' || (scanner.status === 'DISABLED' && this.nodeEnv !== 'production');
    const ready = database.status === 'UP' && queueReady && scannerReady;

    const warnings: string[] = [];
    if (backlog.failedScans > 0) warnings.push('Есть файлы со статусом SCAN_FAILED');
    if (backlog.staleScanning > 0) warnings.push('Есть зависшие SCANNING старше пяти минут');
    if (backlog.openCriticalAlerts > 0) warnings.push('Есть открытые критические security alerts');

    return {
      status: ready ? 'ready' : 'not_ready',
      ready,
      checkedAt: new Date().toISOString(),
      environment: this.nodeEnv,
      dependencies: {
        database,
        queue,
        scanner,
      },
      backlog,
      warnings,
    };
  }

  private async databaseHealth(): Promise<DependencyStatus> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'UP', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        status: 'DOWN',
        latencyMs: Date.now() - startedAt,
        error: (error as Error).message.slice(0, 300),
      };
    }
  }

  private async scannerHealth(): Promise<ScannerHealth | { status: 'DOWN'; mode: 'CLAMAV'; latencyMs: number; error: string }> {
    const startedAt = Date.now();
    try {
      return await this.scanner.healthCheck();
    } catch (error) {
      return {
        status: 'DOWN',
        mode: 'CLAMAV',
        latencyMs: Date.now() - startedAt,
        error: (error as Error).message.slice(0, 300),
      };
    }
  }

  private async backlog() {
    try {
      const rows = await this.prisma.$queryRaw<BacklogRow[]>`
        SELECT
          (
            (SELECT COUNT(*) FROM "PendingUpload" WHERE "scanStatus" IN ('PENDING_SCAN', 'SCANNING')) +
            (SELECT COUNT(*) FROM "MasterDocument" WHERE "scanStatus" IN ('PENDING_SCAN', 'SCANNING')) +
            (SELECT COUNT(*) FROM "DisputeEvidence" WHERE "scanStatus" IN ('PENDING_SCAN', 'SCANNING'))
          ) AS "pendingScans",
          (
            (SELECT COUNT(*) FROM "PendingUpload" WHERE "scanStatus" = 'SCAN_FAILED') +
            (SELECT COUNT(*) FROM "MasterDocument" WHERE "scanStatus" = 'SCAN_FAILED') +
            (SELECT COUNT(*) FROM "DisputeEvidence" WHERE "scanStatus" = 'SCAN_FAILED')
          ) AS "failedScans",
          (
            (SELECT COUNT(*) FROM "PendingUpload" WHERE "scanStatus" = 'SCANNING' AND "scannedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes') +
            (SELECT COUNT(*) FROM "MasterDocument" WHERE "scanStatus" = 'SCANNING' AND "scannedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes') +
            (SELECT COUNT(*) FROM "DisputeEvidence" WHERE "scanStatus" = 'SCANNING' AND "scannedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
          ) AS "staleScanning",
          (SELECT COUNT(*) FROM "SecurityAlert" WHERE "status" != 'RESOLVED' AND "severity" = 'CRITICAL') AS "openCriticalAlerts",
          (SELECT COUNT(*) FROM "SecurityAlert" WHERE "status" != 'RESOLVED' AND "severity" = 'HIGH') AS "openHighAlerts"
      `;
      const row = rows[0];
      return {
        pendingScans: Number(row?.pendingScans ?? 0),
        failedScans: Number(row?.failedScans ?? 0),
        staleScanning: Number(row?.staleScanning ?? 0),
        openCriticalAlerts: Number(row?.openCriticalAlerts ?? 0),
        openHighAlerts: Number(row?.openHighAlerts ?? 0),
      };
    } catch {
      return {
        pendingScans: 0,
        failedScans: 0,
        staleScanning: 0,
        openCriticalAlerts: 0,
        openHighAlerts: 0,
      };
    }
  }
}
