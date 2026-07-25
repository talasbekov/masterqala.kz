import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { MasterStatus, User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { mimeTypeForStoredPath } from '../storage/upload-security';
import { AdminService } from './admin.service';
import { DecisionDto } from './dto';

@Controller('admin/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(
    @Query('status', new ParseEnumPipe(MasterStatus, { optional: true }))
    status?: MasterStatus,
  ) {
    return this.admin.listApplications(status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.admin.getApplication(id);
  }

  @Get(':id/documents/:docId')
  async document(@Param('id') id: string, @Param('docId') docId: string) {
    const { stream, doc } = await this.admin.getDocumentStream(id, docId);
    const mimeType = mimeTypeForStoredPath(doc.filePath);
    if (!mimeType) throw new NotFoundException('Документ не найден');
    const disposition = mimeType === 'application/pdf' ? 'attachment' : 'inline';
    return new StreamableFile(stream, { type: mimeType, disposition });
  }

  @Post(':id/decision')
  decide(@CurrentUser() operator: User, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.admin.decide(operator.id, id, dto);
  }
}
