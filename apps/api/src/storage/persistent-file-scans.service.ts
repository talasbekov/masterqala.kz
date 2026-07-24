import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JOBS } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { FILE_STORAGE, FileStorage } from './storage.interface';
import { QUARANTINE_SCANNER, QuarantineScanner } from './quarantine-scanner.interface';

export type PersistentScanStatus = 'PENDING_SCAN' | 'SCANNING' | 'CLEAN' | 'INFECTED' | 'SCAN_FAILED';

type ScanKind = 'MASTER_DOCUMENT' | 'DISPUTE_EVIDENCE';
type ScanClaim = { id: string; path: string };
type ScanCandidate = { kind: ScanKind; id: string; createdAt: Date };

@Injectable()
export class PersistentFileScansService implements OnModuleInit {
  private readonly logger = new Logger(PersistentFileScansService.name);
  private readonly scanMode: 'DISABLED' | 'CLAMAV';
  private readonly maxScanAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(QUARANTINE_SCANNER) private readonly scanner: QuarantineScanner,
  ) {
    this.scanMode = this.config.get<'DISABLED' | 'CLAMAV'>('FILE_SCAN_MODE') ?? 'DISABLED';
    this.maxScanAttempts = this.config.get<number>('UPLOAD_SCAN_MAX_ATTEMPTS') ?? 3;
  }

  onModuleInit(): void {
    this.queue.register(JOBS.MASTER_DOCUMENT_SCAN, (data: { documentId: string }) =>
      this.scanMasterDocument(data.documentId),
    );
    this.queue.register(JOBS.DISPUTE_EVIDENCE_SCAN, (data: { evidenceId: string }) =>
      this.scanDisputeEvidence(data.evidenceId),
    );
    this.queue.registerCron(JOBS.PERSISTENT_FILE_SCAN_SWEEP, '*/5 * * * *', () => this.scanPending());
  }

  enqueueMasterDocument(documentId: string): Promise<void> {
    return this.enqueue('MASTER_DOCUMENT', documentId);
  }

  enqueueDisputeEvidence(evidenceId: string): Promise<void> {
    return this.enqueue('DISPUTE_EVIDENCE', evidenceId);
  }

  private async enqueue(kind: ScanKind, id: string): Promise<void> {
    if (this.scanMode === 'DISABLED') {
      if (kind === 'MASTER_DOCUMENT') await this.scanMasterDocument(id);
      else await this.scanDisputeEvidence(id);
      return;
    }

    if (kind === 'MASTER_DOCUMENT') {
      await this.queue.send(JOBS.MASTER_DOCUMENT_SCAN, { documentId: id });
    } else {
      await this.queue.send(JOBS.DISPUTE_EVIDENCE_SCAN, { evidenceId: id });
    }
  }

  async scanMasterDocument(documentId: string): Promise<void> {
    const claimed = await this.prisma.$queryRaw<ScanClaim[]>`
      UPDATE "MasterDocument"
      SET "scanStatus" = 'SCANNING',
          "scanAttempts" = "scanAttempts" + 1,
          "scannedAt" = CURRENT_TIMESTAMP,
          "scanError" = NULL
      WHERE "id" = ${documentId}
        AND "scanStatus" IN ('PENDING_SCAN', 'SCAN_FAILED')
        AND "scanAttempts" < ${this.maxScanAttempts}
      RETURNING "id", "filePath" AS "path"
    `;
    const claim = claimed[0];
    if (!claim) return;

    await this.scanClaim(
      'master document',
      claim,
      () => this.markMasterDocumentClean(claim.id),
      (signature) => this.markMasterDocumentInfected(claim.id, signature),
      (message) => this.markMasterDocumentFailed(claim.id, message),
    );
  }

  async scanDisputeEvidence(evidenceId: string): Promise<void> {
    const claimed = await this.prisma.$queryRaw<ScanClaim[]>`
      UPDATE "DisputeEvidence"
      SET "scanStatus" = 'SCANNING',
          "scanAttempts" = "scanAttempts" + 1,
          "scannedAt" = CURRENT_TIMESTAMP,
          "scanError" = NULL
      WHERE "id" = ${evidenceId}
        AND "scanStatus" IN ('PENDING_SCAN', 'SCAN_FAILED')
        AND "scanAttempts" < ${this.maxScanAttempts}
      RETURNING "id", "path"
    `;
    const claim = claimed[0];
    if (!claim) return;

    await this.scanClaim(
      'dispute evidence',
      claim,
      () => this.markDisputeEvidenceClean(claim.id),
      (signature) => this.markDisputeEvidenceInfected(claim.id, signature),
      (message) => this.markDisputeEvidenceFailed(claim.id, message),
    );
  }

  private async scanClaim(
    context: string,
    claim: ScanClaim,
    markClean: () => Promise<unknown>,
    markInfected: (signature: string) => Promise<unknown>,
    markFailed: (message: string) => Promise<unknown>,
  ): Promise<void> {
    try {
      if (!(await this.storage.exists(claim.path))) throw new Error('Quarantine file is missing');

      const result = await this.scanner.scan(this.storage.absolutePath(claim.path));
      if (result.status === 'CLEAN') {
        await markClean();
        return;
      }

      await markInfected(result.signature?.slice(0, 500) ?? 'Malware detected');
      await this.removeInfected(claim.path, context);
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      await markFailed(message);
      this.logger.error(`${context} scan failed for ${claim.id}: ${message}`);
      throw error;
    }
  }

  private markMasterDocumentClean(id: string) {
    return this.prisma.$executeRaw`
      UPDATE "MasterDocument"
      SET "scanStatus" = 'CLEAN', "scannedAt" = CURRENT_TIMESTAMP, "scanError" = NULL
      WHERE "id" = ${id} AND "scanStatus" = 'SCANNING'
    `;
  }

  private markMasterDocumentInfected(id: string, signature: string) {
    return this.prisma.$executeRaw`
      UPDATE "MasterDocument"
      SET "scanStatus" = 'INFECTED', "scannedAt" = CURRENT_TIMESTAMP, "scanError" = ${signature}
      WHERE "id" = ${id} AND "scanStatus" = 'SCANNING'
    `;
  }

  private markMasterDocumentFailed(id: string, message: string) {
    return this.prisma.$executeRaw`
      UPDATE "MasterDocument"
      SET "scanStatus" = 'SCAN_FAILED', "scannedAt" = CURRENT_TIMESTAMP, "scanError" = ${message}
      WHERE "id" = ${id} AND "scanStatus" = 'SCANNING'
    `;
  }

  private markDisputeEvidenceClean(id: string) {
    return this.prisma.$executeRaw`
      WITH cleaned AS (
        UPDATE "DisputeEvidence"
        SET "scanStatus" = 'CLEAN', "scannedAt" = CURRENT_TIMESTAMP, "scanError" = NULL
        WHERE "id" = ${id} AND "scanStatus" = 'SCANNING'
        RETURNING "disputeId", "path"
      )
      UPDATE "Dispute" AS dispute
      SET "evidenceDocIds" = CASE
        WHEN cleaned."path" = ANY(dispute."evidenceDocIds") THEN dispute."evidenceDocIds"
        ELSE array_append(dispute."evidenceDocIds", cleaned."path")
      END
      FROM cleaned
      WHERE dispute."id" = cleaned."disputeId"
    `;
  }

  private markDisputeEvidenceInfected(id: string, signature: string) {
    return this.prisma.$executeRaw`
      UPDATE "DisputeEvidence"
      SET "scanStatus" = 'INFECTED', "scannedAt" = CURRENT_TIMESTAMP, "scanError" = ${signature}
      WHERE "id" = ${id} AND "scanStatus" = 'SCANNING'
    `;
  }

  private markDisputeEvidenceFailed(id: string, message: string) {
    return this.prisma.$executeRaw`
      UPDATE "DisputeEvidence"
      SET "scanStatus" = 'SCAN_FAILED', "scannedAt" = CURRENT_TIMESTAMP, "scanError" = ${message}
      WHERE "id" = ${id} AND "scanStatus" = 'SCANNING'
    `;
  }

  async scanPending(limit = 100): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "MasterDocument"
      SET "scanStatus" = 'SCAN_FAILED', "scanError" = 'Scan lease expired'
      WHERE "scanStatus" = 'SCANNING'
        AND "scannedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    `;
    await this.prisma.$executeRaw`
      UPDATE "DisputeEvidence"
      SET "scanStatus" = 'SCAN_FAILED', "scanError" = 'Scan lease expired'
      WHERE "scanStatus" = 'SCANNING'
        AND "scannedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
    `;

    const candidates = await this.prisma.$queryRaw<ScanCandidate[]>`
      SELECT 'MASTER_DOCUMENT' AS "kind", "id", "createdAt"
      FROM "MasterDocument"
      WHERE "scanStatus" IN ('PENDING_SCAN', 'SCAN_FAILED')
        AND "scanAttempts" < ${this.maxScanAttempts}
      UNION ALL
      SELECT 'DISPUTE_EVIDENCE' AS "kind", "id", "createdAt"
      FROM "DisputeEvidence"
      WHERE "scanStatus" IN ('PENDING_SCAN', 'SCAN_FAILED')
        AND "scanAttempts" < ${this.maxScanAttempts}
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
    `;

    for (const candidate of candidates) await this.enqueue(candidate.kind, candidate.id);
  }

  private async removeInfected(path: string, context: string): Promise<void> {
    try {
      await this.storage.remove(path);
    } catch (error) {
      this.logger.error(`Не удалось удалить infected ${context} ${path}: ${(error as Error).message}`);
    }
  }
}
