import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { SecurityAuditQueryDto } from './security-audit.dto';
import { SecurityAuditService } from './security-audit.service';

@Controller('admin/security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class SecurityAuditController {
  constructor(private readonly audit: SecurityAuditService) {}

  @Get('events')
  list(@Query() query: SecurityAuditQueryDto) {
    return this.audit.list(query);
  }
}
