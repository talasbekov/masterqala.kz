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

    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "PendingUpload"
      WHERE "userId" = ${userId}
        AND "path" = ANY(${paths as string[]})
        AND "scanStatus" = 'CLEAN'
        AND "consumedAt" IS NULL
        AND "expiresAt" > CURRENT_TIMESTAMP
    `;
    if (Number(rows[0]?.count ?? 0) !== paths.length) {
      throw new BadRequestException('Фото недоступно, не прошло проверку, истекло или уже использовано');
    }

    for (const path of paths) {
      if (!(await this.storage.exists(path))) {
        throw new BadRequestException('Загруженное фото не найдено');
      }
    }
  }
}
