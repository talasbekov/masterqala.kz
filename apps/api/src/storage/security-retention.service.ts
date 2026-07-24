import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JOBS } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { FILE_STORAGE, FileStorage } from './storage.interface';

type FileKind = 'MASTER_DOCUMENT' | 'DISPUTE_EVIDENCE';
type FileCandidate = { kind: FileKind; id: string; path: string };
type PendingCandidate = { id: string; path: string };

@Injectable()
export class SecurityRetentionService implements OnModuleInit {
  private readonly logger = new Logger(SecurityRetentionService.name);
  private readonly auditRetentionDays: number;
  private readonly quarantineRetentionDays: number;
  private readonly consumedMetadataRetentionDays: number;
  private readonly maxScanAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {
    this.auditRetentionDays = this.config.get<number>('SECURITY_AUDIT_RETENTION_DAYS') ?? 365;
    this.quarantineRetentionDays = this.config.get<number>('FILE_QUARANTINE_RETENTION_DAYS') ?? 30;
    this.consumedMetadataRetentionDays =
      this.config.get<number>('CONSUMED_UPLOAD_METADATA_RETENTION_DAYS') ?? 30;
    this.maxScanAttempts = this.config.get<number>('UPLOAD_SCAN_MAX_ATTEMPTS') ?? 3;
  }

  onModuleInit(): void {
    this.queue.registerCron(JOBS.SECURITY_RETENTION, '43 3 * * *', () => this.runRetention());
  }

  async runRetention(limit = 100): Promise<void> {
    await this.purgeTerminalPendingUploads(limit);
    await this.purgeConsumedUploadMetadata(limit);
    await this.purgePersistentTerminalBinaries(limit);
    await this.redactPersistentScanErrors();
    await this.purgeExpiredAuditEvents();
  }

  private async purgeTerminalPendingUploads(limit: number): Promise<void> {
    const cutoff = this.daysAgo(this.quarantineRetentionDays);
    const rows = await this.prisma.$queryRaw<PendingCandidate[]>`
      SELECT "id", "path"
      FROM "PendingUpload"
      WHERE "consumedAt" IS NULL
        AND (
          "scanStatus" = 'INFECTED'
          OR ("scanStatus" = 'SCAN_FAILED' AND "scanAttempts" >= ${this.maxScanAttempts})
        )
        AND COALESCE("scannedAt", "createdAt") < ${cutoff}
      ORDER BY COALESCE("scannedAt", "createdAt") ASC
      LIMIT ${limit}
    `;

    for (const row of rows) {
      try {
        await this.storage.remove(row.path);
        await this.prisma.$executeRaw`
          DELETE FROM "PendingUpload"
          WHERE "id" = ${row.id}
            AND "consumedAt" IS NULL
            AND (
              "scanStatus" = 'INFECTED'
              OR ("scanStatus" = 'SCAN_FAILED' AND "scanAttempts" >= ${this.maxScanAttempts})
            )
        `;
      } catch (error) {
        this.logger.error(`Не удалось очистить terminal upload ${row.id}: ${(error as Error).message}`);
      }
    }
  }

  private async purgeConsumedUploadMetadata(limit: number): Promise<void> {
    const cutoff = this.daysAgo(this.consumedMetadataRetentionDays);
    await this.prisma.$executeRaw`
      DELETE FROM "PendingUpload"
      WHERE "id" IN (
        SELECT "id"
        FROM "PendingUpload"
        WHERE "consumedAt" IS NOT NULL AND "consumedAt" < ${cutoff}
        ORDER BY "consumedAt" ASC
        LIMIT ${limit}
      )
    `;
  }

  private async purgePersistentTerminalBinaries(limit: number): Promise<void> {
    const cutoff = this.daysAgo(this.quarantineRetentionDays);
    const rows = await this.prisma.$queryRaw<FileCandidate[]>`
      SELECT 'MASTER_DOCUMENT' AS "kind", "id", "filePath" AS "path"
      FROM "MasterDocument"
      WHERE "purgedAt" IS NULL
        AND (
          "scanStatus" = 'INFECTED'
          OR ("scanStatus" = 'SCAN_FAILED' AND "scanAttempts" >= ${this.maxScanAttempts})
        )
        AND COALESCE("scannedAt", "createdAt") < ${cutoff}
      UNION ALL
      SELECT 'DISPUTE_EVIDENCE' AS "kind", "id", "path"
      FROM "DisputeEvidence"
      WHERE "purgedAt" IS NULL
        AND (
          "scanStatus" = 'INFECTED'
          OR ("scanStatus" = 'SCAN_FAILED' AND "scanAttempts" >= ${this.maxScanAttempts})
        )
        AND COALESCE("scannedAt", "createdAt") < ${cutoff}
      LIMIT ${limit}
    `;

    for (const row of rows) {
      try {
        await this.storage.remove(row.path);
        if (row.kind === 'MASTER_DOCUMENT') {
          await this.prisma.$executeRaw`
            UPDATE "MasterDocument"
            SET "purgedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${row.id} AND "purgedAt" IS NULL
          `;
        } else {
          await this.prisma.$executeRaw`
            UPDATE "DisputeEvidence"
            SET "purgedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${row.id} AND "purgedAt" IS NULL
          `;
        }
      } catch (error) {
        this.logger.error(`Не удалось удалить terminal ${row.kind} ${row.id}: ${(error as Error).message}`);
      }
    }
  }

  private async redactPersistentScanErrors(): Promise<void> {
    const cutoff = this.daysAgo(this.quarantineRetentionDays);
    await this.prisma.$executeRaw`
      UPDATE "MasterDocument"
      SET "scanError" = NULL
      WHERE "purgedAt" IS NOT NULL
        AND "scanError" IS NOT NULL
        AND COALESCE("scannedAt", "createdAt") < ${cutoff}
    `;
    await this.prisma.$executeRaw`
      UPDATE "DisputeEvidence"
      SET "scanError" = NULL
      WHERE "purgedAt" IS NOT NULL
        AND "scanError" IS NOT NULL
        AND COALESCE("scannedAt", "createdAt") < ${cutoff}
    `;
  }

  private async purgeExpiredAuditEvents(): Promise<void> {
    const cutoff = this.daysAgo(this.auditRetentionDays);
    const deleted = await this.prisma.$executeRaw`
      DELETE FROM "SecurityAuditEvent" WHERE "createdAt" < ${cutoff}
    `;

    if (deleted > 0) {
      await this.prisma.$executeRaw`
        INSERT INTO "SecurityAuditEvent" (
          "action", "severity", "outcome", "resourceType", "resourceId", "metadata"
        ) VALUES (
          'SECURITY_AUDIT_RETENTION_PURGE', 'INFO', 'DELETED', 'SYSTEM', 'security-audit',
          jsonb_build_object('deletedCount', ${deleted}, 'retentionDays', ${this.auditRetentionDays})
        )
      `;
    }
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
}
