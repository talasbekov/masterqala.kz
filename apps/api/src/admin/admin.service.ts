import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DecisionType, MasterStatus } from '@prisma/client';
import { createReadStream } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { FILE_STORAGE, FileStorage } from '../storage/storage.interface';
import { DecisionDto } from './dto';

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
    return profile;
  }

  async getDocumentStream(profileId: string, docId: string) {
    const doc = await this.prisma.masterDocument.findFirst({
      where: { id: docId, masterProfileId: profileId },
    });
    if (!doc) throw new NotFoundException('Документ не найден');
    return { stream: createReadStream(this.storage.absolutePath(doc.filePath)), doc };
  }

  async decide(operatorId: string, profileId: string, dto: DecisionDto) {
    const profile = await this.prisma.masterProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Заявка не найдена');
    if (profile.status !== 'PENDING_REVIEW') {
      throw new ConflictException('Заявка не находится на рассмотрении');
    }
    if (dto.decision !== 'APPROVE' && !dto.comment) {
      throw new BadRequestException('Укажите причину решения');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.masterProfile.update({
        where: { id: profileId },
        data: {
          status: AdminService.TRANSITIONS[dto.decision],
          rejectionReason: dto.decision === 'REJECT' ? dto.comment : null,
        },
      }),
      this.prisma.verificationDecision.create({
        data: {
          masterProfileId: profileId,
          operatorId,
          decision: dto.decision,
          comment: dto.comment,
        },
      }),
    ]);
    return updated;
  }
}
