import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitApplicationDto } from './dto';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';
import { PersistentFileScansService, PersistentScanStatus } from '../storage/persistent-file-scans.service';
import { validateUploadedFile } from '../storage/upload-security';

const PROFILE_INCLUDE = {
  categories: { include: { category: true } },
  documents: true,
} as const;

type MasterDocumentSecurityRow = {
  id: string;
  type: DocumentType;
  filePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: PersistentScanStatus;
  scannedAt: Date | null;
  cdrStatus: 'NOT_REQUIRED' | 'PENDING' | 'SANITIZED' | 'BYPASSED' | 'CDR_FAILED';
};

@Injectable()
export class MastersService {
  static readonly MAX_FILE_BYTES = 10 * 1024 * 1024;
  private readonly logger = new Logger(MastersService.name);
  private readonly pdfCdrMode: 'BYPASS' | 'REQUIRED';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly fileScans: PersistentFileScansService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {
    this.pdfCdrMode = this.config.get<'BYPASS' | 'REQUIRED'>('PDF_CDR_MODE') ?? 'BYPASS';
  }

  async submitApplication(userId: string, dto: SubmitApplicationDto) {
    const categories = await this.prisma.category.findMany({ where: { id: { in: dto.categoryIds } } });
    if (categories.length !== dto.categoryIds.length) {
      throw new BadRequestException('Неизвестная категория');
    }

    const existing = await this.prisma.masterProfile.findUnique({ where: { userId } });
    if (existing && (existing.status === 'PENDING_REVIEW' || existing.status === 'ACTIVE')) {
      throw new ConflictException('Заявка уже на рассмотрении или профиль активен');
    }

    const fields = {
      fullName: dto.fullName,
      iin: dto.iin,
      district: dto.district,
      experienceYears: dto.experienceYears,
      status: 'PENDING_REVIEW' as const,
      rejectionReason: null,
    };

    if (existing) {
      return this.prisma.masterProfile.update({
        where: { id: existing.id },
        data: {
          ...fields,
          categories: {
            deleteMany: {},
            create: dto.categoryIds.map((categoryId) => ({ categoryId })),
          },
        },
        include: PROFILE_INCLUDE,
      });
    }
    return this.prisma.masterProfile.create({
      data: {
        ...fields,
        userId,
        categories: { create: dto.categoryIds.map((categoryId) => ({ categoryId })) },
      },
      include: PROFILE_INCLUDE,
    });
  }

  async getOwnApplication(userId: string) {
    const profile = await this.prisma.masterProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    if (!profile) throw new NotFoundException('Заявка не найдена');
    const latest = await this.prisma.verificationDecision.findFirst({
      where: { masterProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    const securityRows = await this.prisma.$queryRaw<MasterDocumentSecurityRow[]>`
      SELECT "id", "type", "filePath", "originalName", "mimeType", "sizeBytes",
             "scanStatus", "scannedAt", "cdrStatus"
      FROM "MasterDocument"
      WHERE "masterProfileId" = ${profile.id}
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
      latestDecisionComment: latest?.comment ?? null,
    };
  }

  async uploadDocument(userId: string, type: DocumentType, file: Express.Multer.File) {
    const profile = await this.prisma.masterProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Сначала заполните анкету');
    if (profile.status !== 'PENDING_REVIEW' && profile.status !== 'NEEDS_INFO') {
      throw new ConflictException('Документы можно загружать только пока заявка на проверке');
    }

    const validated = validateUploadedFile(file, ['jpeg', 'png', 'pdf'], MastersService.MAX_FILE_BYTES);
    if (validated.kind === 'pdf' && this.pdfCdrMode === 'REQUIRED') {
      throw new ServiceUnavailableException('PDF временно недоступен: обязательная CDR-обработка ещё не подключена');
    }

    const relPath = await this.storage.save(file.buffer, validated.extension);
    let document: { id: string };

    try {
      document = await this.prisma.masterDocument.create({
        data: {
          masterProfileId: profile.id,
          type,
          filePath: relPath,
          originalName: validated.originalName,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
        },
        select: { id: true },
      });
      const cdrStatus = validated.kind === 'pdf' ? 'BYPASSED' : 'NOT_REQUIRED';
      await this.prisma.$executeRaw`
        UPDATE "MasterDocument"
        SET "cdrStatus" = ${cdrStatus}
        WHERE "id" = ${document.id}
      `;
    } catch (error) {
      await this.removeOrphan(relPath);
      throw error;
    }

    await this.fileScans.enqueueMasterDocument(document.id);
    return this.getDocumentStatus(userId, document.id);
  }

  async getDocumentStatus(userId: string, documentId: string) {
    const rows = await this.prisma.$queryRaw<MasterDocumentSecurityRow[]>`
      SELECT document."id", document."type", document."filePath", document."originalName", document."mimeType",
             document."sizeBytes", document."scanStatus", document."scannedAt", document."cdrStatus"
      FROM "MasterDocument" AS document
      JOIN "MasterProfile" AS profile ON profile."id" = document."masterProfileId"
      WHERE document."id" = ${documentId} AND profile."userId" = ${userId}
      LIMIT 1
    `;
    const document = rows[0];
    if (!document) throw new NotFoundException('Документ не найден');
    return {
      id: document.id,
      type: document.type,
      path: document.filePath,
      originalName: document.originalName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      scanStatus: document.scanStatus,
      scannedAt: document.scannedAt,
      cdrStatus: document.cdrStatus,
      statusPath: `/masters/application/documents/${document.id}/status`,
    };
  }

  private async removeOrphan(relPath: string): Promise<void> {
    try {
      await this.storage.remove(relPath);
    } catch (error) {
      this.logger.error(`Не удалось удалить orphan master document ${relPath}: ${(error as Error).message}`);
    }
  }
}
