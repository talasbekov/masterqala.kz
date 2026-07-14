import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MasterStatus } from '@prisma/client';
import { createReadStream } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { FILE_STORAGE, FileStorage } from '../storage/storage.interface';

@Injectable()
export class AdminService {
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
}
