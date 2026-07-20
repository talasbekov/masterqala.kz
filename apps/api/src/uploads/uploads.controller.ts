import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors, Inject } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileStorage, FILE_STORAGE } from '../storage/storage.interface';

const ALLOWED_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл обязателен');
    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) throw new BadRequestException('Допустимы только JPEG и PNG');
    const path = await this.storage.save(file.buffer, ext);
    return { path };
  }
}
