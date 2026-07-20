import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AdminOrdersService } from './admin-orders.service';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminOrdersController {
  constructor(private readonly admin: AdminOrdersService) {}

  @Get()
  list(
    @Query('type') type?: 'urgent' | 'planned',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.list({ type, status, search });
  }

  @Get(':id')
  detail(@Param('id') id: string, @Query('type') type: 'urgent' | 'planned' = 'urgent') {
    return this.admin.detail(id, type);
  }
}
