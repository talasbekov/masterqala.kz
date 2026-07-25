import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PendingUploadsService } from '../storage/pending-uploads.service';
import { validateUploadedFile } from '../storage/upload-security';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly pendingUploads: PendingUploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл обязателен');
    const validated = validateUploadedFile(file, ['jpeg', 'png'], MAX_FILE_BYTES);
    return this.pendingUploads.register(user.id, file.buffer, validated);
  }

  @Get(':path/status')
  status(@CurrentUser() user: User, @Param('path') path: string) {
    return this.pendingUploads.getStatus(user.id, path);
  }
}
