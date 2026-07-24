import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitApplicationDto } from './dto';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';
import { validateUploadedFile } from '../storage/upload-security';

const PROFILE_INCLUDE = {
  categories: { include: { category: true } },
  documents: true,
} as const;

@Injectable()
export class MastersService {
  static readonly MAX_FILE_BYTES = 10 * 1024 * 1024;
  private readonly logger = new Logger(MastersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

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
    return { ...profile, latestDecisionComment: latest?.comment ?? null };
  }

  async uploadDocument(userId: string, type: DocumentType, file: Express.Multer.File) {
    const profile = await this.prisma.masterProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Сначала заполните анкету');
    if (profile.status !== 'PENDING_REVIEW' && profile.status !== 'NEEDS_INFO') {
      throw new ConflictException('Документы можно загружать только пока заявка на проверке');
    }

    const validated = validateUploadedFile(file, ['jpeg', 'png', 'pdf'], MastersService.MAX_FILE_BYTES);
    const relPath = await this.storage.save(file.buffer, validated.extension);

    try {
      return await this.prisma.masterDocument.create({
        data: {
          masterProfileId: profile.id,
          type,
          filePath: relPath,
          originalName: validated.originalName,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
        },
      });
    } catch (error) {
      await this.removeOrphan(relPath);
      throw error;
    }
  }

  private async removeOrphan(relPath: string): Promise<void> {
    try {
      await this.storage.remove(relPath);
    } catch (error) {
      this.logger.error(`Не удалось удалить orphan master document ${relPath}: ${(error as Error).message}`);
    }
  }
}
