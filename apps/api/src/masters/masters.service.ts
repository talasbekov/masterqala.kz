import { BadRequestException, ConflictException, Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitApplicationDto } from './dto';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';

const PROFILE_INCLUDE = {
  categories: { include: { category: true } },
  documents: true,
} as const;

@Injectable()
export class MastersService {
  private static readonly ALLOWED_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf',
  };
  static readonly MAX_FILE_BYTES = 10 * 1024 * 1024;

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
    const ext = MastersService.ALLOWED_MIME[file.mimetype];
    if (!ext) throw new BadRequestException('Допустимы только JPEG, PNG и PDF');
    if (file.size > MastersService.MAX_FILE_BYTES) {
      throw new BadRequestException('Файл больше 10 МБ');
    }
    const relPath = await this.storage.save(file.buffer, ext);
    return this.prisma.masterDocument.create({
      data: {
        masterProfileId: profile.id,
        type,
        filePath: relPath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });
  }
}
