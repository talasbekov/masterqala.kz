import { Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JOBS } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { FILE_STORAGE, FileStorage } from './storage.interface';
import { QUARANTINE_SCANNER, QuarantineScanner } from './quarantine-scanner.interface';
import { ValidatedUpload } from './upload-security';

type UploadScanStatus = 'PENDING_SCAN' | 'SCANNING' | 'CLEAN' | 'INFECTED' | 'SCAN_FAILED';

type UploadStatusRow = {
  id: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: Date;
  scanStatus: UploadScanStatus;
  scannedAt: Date | null;
  purgedAt: Date | null;
};

type ScanClaim = { id: string; path: string };
type CleanupCandidate = { id: string; path: string };

@Injectable()
export class PendingUploadsService implements OnModuleInit {
  private readonly logger = new Logger(PendingUploadsService.name);
  private readonly ttlHours: number;
  private readonly scanMode: 'DISABLED' | 'CLAMAV';
  private readonly maxScanAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(QUARANTINE_SCANNER) private readonly scanner: QuarantineScanner,
  ) {
    this.ttlHours = this.config.get<number>('UPLOAD_TTL_HOURS') ?? 24;
    this.scanMode = this.config.get<'DISABLED' | 'CLAMAV'>('FILE_SCAN_MODE') ?? 'DISABLED';
    this.maxScanAttempts = this.config.get<number>('UPLOAD_SCAN_MAX_ATTEMPTS') ?? 3;
  }

  onModuleInit(): void {
    this.queue.register(JOBS.UPLOAD_SCAN, (data: { pendingUploadId: string }) =>
      this.scanUpload(data.pendingUploadId),
    );
    this.queue.registerCron(JOBS.UPLOAD_SCAN_SWEEP, '*/5 * * * *', () => this.scanPending());
    this.queue.registerCron(JOBS.UPLOAD_CLEANUP, '17 * * * *', () => this.cleanupExpired());
  }

  async register(userId: string, buffer: Buffer, upload: ValidatedUpload) {
    const path = await this.storage.save(buffer, upload.extension);
    const expiresAt = new Date(Date.now() + this.ttlHours * 3600 * 1000);

    try {
      const record = await this.prisma.pendingUpload.create({
        data: {
          userId,
          path,
          mimeType: upload.mimeType,
          sizeBytes: upload.sizeBytes,
          expiresAt,
        },
      });

      if (this.scanMode === 'DISABLED') {
        await this.scanUpload(record.id);
      } else {
        await this.queue.send(JOBS.UPLOAD_SCAN, { pendingUploadId: record.id });
      }

      return this.getStatus(userId, path);
    } catch (error) {
      const persisted = await this.prisma.pendingUpload.count({ where: { path } }).catch(() => 0);
      if (persisted === 0) await this.removeFile(path, 'registration failure');
      throw error;
    }
  }

  async getStatus(userId: string, path: string) {
    const rows = await this.prisma.$queryRaw<UploadStatusRow[]>`
      SELECT "id", "path", "mimeType", "sizeBytes", "expiresAt", "scanStatus", "scannedAt", "purgedAt"
      FROM "PendingUpload"
      WHERE "userId" = ${userId} AND "path" = ${path}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Upload не найден');
    return {
      path: row.path,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      expiresAt: row.expiresAt,
      scanStatus: row.scanStatus,
      scannedAt: row.scannedAt,
      purgedAt: row.purgedAt,
    };
  }

  async scanUpload(pendingUploadId: string): Promise<void> {
    const claimed = await this.prisma.$queryRaw<ScanClaim[]>`
      UPDATE "PendingUpload"
      SET "scanStatus" = 'SCANNING',
          "scanAttempts" = "scanAttempts" + 1,
          "scannedAt" = CURRENT_TIMESTAMP,
          "scanError" = NULL
      WHERE "id" = ${pendingUploadId}
        AND "consumedAt" IS NULL
        AND "expiresAt" > CURRENT_TIMESTAMP
        AND "scanStatus" IN ('PENDING_SCAN', 'SCAN_FAILED')
        AND "scanAttempts" < ${this.maxScanAttempts}
      RETURNING "id", "path"
    `;
    const upload = claimed[0];
    if (!upload) return;

    try {
      if (!(await this.storage.exists(upload.path))) {
        throw new Error('Quarantine file is missing');
      }

      const result = await this.scanner.scan(this.storage.absolutePath(upload.path));
      if (result.status === 'CLEAN') {
        await this.prisma.$executeRaw`
          UPDATE "PendingUpload"
          SET "scanStatus" = 'CLEAN', "scannedAt" = CURRENT_TIMESTAMP, "scanError" = NULL
          WHERE "id" = ${upload.id} AND "scanStatus" = 'SCANNING'
        `;
        return;
      }

      await this.prisma.$executeRaw`
        UPDATE "PendingUpload"
        SET "scanStatus" = 'INFECTED',
            "scannedAt" = CURRENT_TIMESTAMP,
            "scanError" = ${result.signature?.slice(0, 500) ?? 'Malware detected'}
        WHERE "id" = ${upload.id} AND "scanStatus" = 'SCANNING'
      `;
      if (await this.removeFile(upload.path, 'infected upload')) {
        await this.prisma.$executeRaw`
          UPDATE "PendingUpload"
          SET "purgedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${upload.id} AND "purgedAt" IS NULL
        `;
      }
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      await this.prisma.$executeRaw`
        UPDATE "PendingUpload"
        SET "scanStatus" = 'SCAN_FAILED', "scannedAt" = CURRENT_TIMESTAMP, "scanError" = ${message}
        WHERE "id" = ${upload.id} AND "scanStatus" = 'SCANNING'
      `;
      this.logger.error(`Upload scan failed for ${upload.id}: ${message}`);
      throw error;
    }
  }

  async scanPending(limit = 100): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "PendingUpload"
      SET "scanStatus" = 'SCAN_FAILED', "scanError" = 'Scan lease expired'
      WHERE "scanStatus" = 'SCANNING'
        AND "scannedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        AND "consumedAt" IS NULL
    `;

    const candidates = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "PendingUpload"
      WHERE "scanStatus" IN ('PENDING_SCAN', 'SCAN_FAILED')
        AND "scanAttempts" < ${this.maxScanAttempts}
        AND "consumedAt" IS NULL
        AND "expiresAt" > CURRENT_TIMESTAMP
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
    `;

    for (const candidate of candidates) {
      if (this.scanMode === 'DISABLED') {
        await this.scanUpload(candidate.id);
      } else {
        await this.queue.send(JOBS.UPLOAD_SCAN, { pendingUploadId: candidate.id });
      }
    }
  }

  async cleanupExpired(limit = 100): Promise<void> {
    const rows = await this.prisma.$queryRaw<CleanupCandidate[]>`
      SELECT "id", "path"
      FROM "PendingUpload"
      WHERE "consumedAt" IS NULL
        AND "expiresAt" <= CURRENT_TIMESTAMP
        AND "scanStatus" IN ('PENDING_SCAN', 'SCANNING', 'CLEAN')
      ORDER BY "expiresAt" ASC
      LIMIT ${limit}
    `;

    for (const upload of rows) {
      try {
        await this.storage.remove(upload.path);
        await this.prisma.$executeRaw`
          DELETE FROM "PendingUpload"
          WHERE "id" = ${upload.id}
            AND "consumedAt" IS NULL
            AND "expiresAt" <= CURRENT_TIMESTAMP
            AND "scanStatus" IN ('PENDING_SCAN', 'SCANNING', 'CLEAN')
        `;
      } catch (error) {
        this.logger.error(`Не удалось очистить expired upload ${upload.path}: ${(error as Error).message}`);
      }
    }
  }

  private async removeFile(path: string, context: string): Promise<boolean> {
    try {
      await this.storage.remove(path);
      return true;
    } catch (error) {
      this.logger.error(`Не удалось удалить upload ${path} (${context}): ${(error as Error).message}`);
      return false;
    }
  }
}
