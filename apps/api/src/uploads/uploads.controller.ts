import { BadRequestException, Controller, Inject, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';
import { validateUploadedFile } from '../storage/upload-security';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл обязателен');
    const validated = validateUploadedFile(file, ['jpeg', 'png'], MAX_FILE_BYTES);
    const path = await this.storage.save(file.buffer, validated.extension);
    return { path, mimeType: validated.mimeType, sizeBytes: validated.sizeBytes };
  }
}
