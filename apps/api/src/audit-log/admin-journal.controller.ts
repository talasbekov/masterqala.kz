import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuditLogService } from './audit-log.service';

@Controller('admin/journal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminJournalController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  list(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number) {
    return this.auditLog.list(page);
  }
}
