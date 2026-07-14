import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitApplicationDto } from './dto';

const PROFILE_INCLUDE = {
  categories: { include: { category: true } },
  documents: true,
} as const;

@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

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
    return profile;
  }
}
