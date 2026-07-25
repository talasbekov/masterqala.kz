import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { User } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { MastersService } from './masters.service';
import { SubmitApplicationDto, UploadDocumentDto } from './dto';

@Controller()
export class MastersController {
  constructor(
    private readonly masters: MastersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('categories')
  listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('masters/application')
  @UseGuards(JwtAuthGuard)
  submit(@CurrentUser() user: User, @Body() dto: SubmitApplicationDto) {
    return this.masters.submitApplication(user.id, dto);
  }

  @Get('masters/application')
  @UseGuards(JwtAuthGuard)
  getOwn(@CurrentUser() user: User) {
    return this.masters.getOwnApplication(user.id);
  }

  @Post('masters/application/documents')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MastersService.MAX_FILE_BYTES } }))
  uploadDocument(
    @CurrentUser() user: User,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл обязателен');
    return this.masters.uploadDocument(user.id, dto.type, file);
  }

  @Get('masters/application/documents/:id/status')
  @UseGuards(JwtAuthGuard)
  documentStatus(@CurrentUser() user: User, @Param('id') id: string) {
    return this.masters.getDocumentStatus(user.id, id);
  }
}
