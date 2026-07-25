import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AdminMastersService } from './admin-masters.service';

@Controller('admin/masters')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminMastersController {
  constructor(private readonly admin: AdminMastersService) {}

  @Get()
  list(@Query('category') category?: string, @Query('district') district?: string) {
    return this.admin.list(category, district);
  }
}
