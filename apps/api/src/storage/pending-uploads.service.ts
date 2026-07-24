import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JOBS } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { FILE_STORAGE, FileStorage } from './storage.interface';
import { ValidatedUpload } from './upload-security';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PendingUploadsService implements OnModuleInit {
  private readonly logger = new Logger(PendingUploadsService.name);
  private readonly ttlHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {
    this.ttlHours = this.config.get<number>('UPLOAD_TTL_HOURS') ?? 24;
  }

  onModuleInit(): void {
    this.queue.registerCron(JOBS.UPLOAD_CLEANUP, '17 * * * *', () => this.cleanupExpired());
  }

  async register(userId: string, buffer: Buffer, upload: ValidatedUpload) {
    const path = await this.storage.save(buffer, upload.extension);
    const expiresAt = new Date(Date.now() + this.ttlHours * 3600 * 1000);

    try {
      const record = await this.prisma.pendingUpload.create({
        data: {
          userId,
          path,
          mimeType: upload.mimeType,
          sizeBytes: upload.sizeBytes,
          expiresAt,
        },
      });
      return {
        path: record.path,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        expiresAt: record.expiresAt,
      };
    } catch (error) {
      await this.removeOrphan(path, 'registration failure');
      throw error;
    }
  }

  async consume(tx: Tx, userId: string, paths?: readonly string[]): Promise<void> {
    if (!paths?.length) return;

    const now = new Date();
    const result = await tx.pendingUpload.updateMany({
      where: {
        userId,
        path: { in: [...paths] },
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });

    if (result.count !== paths.length) {
      throw new BadRequestException('Фото недоступно, истекло или уже использовано');
    }
  }

  async cleanupExpired(limit = 100): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.pendingUpload.findMany({
      where: { consumedAt: null, expiresAt: { lte: now } },
      orderBy: { expiresAt: 'asc' },
      take: limit,
      select: { id: true, path: true },
    });

    for (const upload of expired) {
      try {
        await this.storage.remove(upload.path);
        await this.prisma.pendingUpload.deleteMany({
          where: { id: upload.id, consumedAt: null, expiresAt: { lte: now } },
        });
      } catch (error) {
        this.logger.error(`Не удалось очистить expired upload ${upload.path}: ${(error as Error).message}`);
      }
    }
  }

  private async removeOrphan(path: string, context: string): Promise<void> {
    try {
      await this.storage.remove(path);
    } catch (error) {
      this.logger.error(`Не удалось удалить orphan upload ${path} (${context}): ${(error as Error).message}`);
    }
  }
}
