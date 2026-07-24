import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DecisionType, MasterStatus } from '@prisma/client';
import { createReadStream } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { FILE_STORAGE, FileStorage } from '../storage/storage.interface';
import { PersistentScanStatus } from '../storage/persistent-file-scans.service';
import { DecisionDto } from './dto';

type DocumentSecurityRow = {
  id: string;
  masterProfileId: string;
  type: string;
  filePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  scanStatus: PersistentScanStatus;
  scannedAt: Date | null;
  cdrStatus: 'NOT_REQUIRED' | 'PENDING' | 'SANITIZED' | 'BYPASSED' | 'CDR_FAILED';
};

@Injectable()
export class AdminService {
  private static readonly TRANSITIONS: Record<DecisionType, MasterStatus> = {
    APPROVE: 'ACTIVE',
    REJECT: 'REJECTED',
    REQUEST_INFO: 'NEEDS_INFO',
  };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  listApplications(status?: MasterStatus) {
    return this.prisma.masterProfile.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fullName: true,
        district: true,
        status: true,
        createdAt: true,
        user: { select: { phone: true } },
        categories: { include: { category: true } },
      },
    });
  }

  async getApplication(id: string) {
    const profile = await this.prisma.masterProfile.findUnique({
      where: { id },
      include: {
        user: { select: { phone: true } },
        categories: { include: { category: true } },
        documents: true,
        decisions: {
          orderBy: { createdAt: 'desc' },
          include: { operator: { select: { name: true, phone: true } } },
        },
      },
    });
    if (!profile) throw new NotFoundException('Заявка не найдена');

    const securityRows = await this.prisma.$queryRaw<DocumentSecurityRow[]>`
      SELECT "id", "masterProfileId", "type", "filePath", "originalName", "mimeType",
             "sizeBytes", "createdAt", "scanStatus", "scannedAt", "cdrStatus"
      FROM "MasterDocument"
      WHERE "masterProfileId" = ${id}
    `;
    const securityById = new Map(securityRows.map((row) => [row.id, row]));

    return {
      ...profile,
      documents: profile.documents.map((document) => ({
        ...document,
        scanStatus: securityById.get(document.id)?.scanStatus ?? 'SCAN_FAILED',
        scannedAt: securityById.get(document.id)?.scannedAt ?? null,
        cdrStatus: securityById.get(document.id)?.cdrStatus ?? 'CDR_FAILED',
      })),
    };
  }

  async getDocumentStream(profileId: string, docId: string) {
    const rows = await this.prisma.$queryRaw<DocumentSecurityRow[]>`
      SELECT "id", "masterProfileId", "type", "filePath", "originalName", "mimeType",
             "sizeBytes", "createdAt", "scanStatus", "scannedAt", "cdrStatus"
      FROM "MasterDocument"
      WHERE "id" = ${docId}
        AND "masterProfileId" = ${profileId}
        AND "scanStatus" = 'CLEAN'
        AND "cdrStatus" IN ('NOT_REQUIRED', 'SANITIZED', 'BYPASSED')
      LIMIT 1
    `;
    const doc = rows[0];
    if (!doc) throw new NotFoundException('Документ не найден');
    return { stream: createReadStream(this.storage.absolutePath(doc.filePath)), doc };
  }

  async decide(operatorId: string, profileId: string, dto: DecisionDto) {
    if (dto.decision !== 'APPROVE' && !dto.comment) {
      throw new BadRequestException('Укажите причину решения');
    }
    const profile = await this.prisma.masterProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Заявка не найдена');

    const blocked = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS "count"
      FROM "MasterDocument"
      WHERE "masterProfileId" = ${profileId}
        AND (
          "scanStatus" <> 'CLEAN'
          OR "cdrStatus" NOT IN ('NOT_REQUIRED', 'SANITIZED', 'BYPASSED')
        )
    `;
    if ((blocked[0]?.count ?? 0) > 0) {
      throw new ConflictException('Проверка безопасности документов ещё не завершена');
    }

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.masterProfile.updateMany({
        where: { id: profileId, status: 'PENDING_REVIEW' },
        data: {
          status: AdminService.TRANSITIONS[dto.decision],
          rejectionReason: dto.decision === 'REJECT' ? dto.comment : null,
        },
      });
      if (count === 0) {
        throw new ConflictException('Заявка не находится на рассмотрении');
      }
      await tx.verificationDecision.create({
        data: {
          masterProfileId: profileId,
          operatorId,
          decision: dto.decision,
          comment: dto.comment,
        },
      });
      return tx.masterProfile.findUniqueOrThrow({ where: { id: profileId } });
    });
  }
}
