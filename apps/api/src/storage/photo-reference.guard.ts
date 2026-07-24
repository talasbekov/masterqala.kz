import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FILE_STORAGE, FileStorage } from './storage.interface';
import { isCanonicalStoredPhotoPath } from './upload-security';

@Injectable()
export class PhotoReferenceGuard {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async assertAvailable(userId: string, paths?: readonly string[]): Promise<void> {
    if (!paths?.length) return;

    for (const path of paths) {
      if (!isCanonicalStoredPhotoPath(path)) {
        throw new BadRequestException('Некорректная ссылка на фото');
      }
    }

    const available = await this.prisma.pendingUpload.count({
      where: {
        userId,
        path: { in: [...paths] },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (available !== paths.length) {
      throw new BadRequestException('Фото недоступно, истекло или уже использовано');
    }

    for (const path of paths) {
      if (!(await this.storage.exists(path))) {
        throw new BadRequestException('Загруженное фото не найдено');
      }
    }
  }
}
