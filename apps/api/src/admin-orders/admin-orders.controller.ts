import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService } from '../orders/orders.service';
import { AdminOrdersService } from './admin-orders.service';
import { AssignOrderDto } from './dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminOrdersController {
  constructor(
    private readonly admin: AdminOrdersService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  list(
    @Query('type') type?: 'urgent' | 'planned',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.admin.list({ type, status, search });
  }

  @Get(':id/candidates')
  candidates(@Param('id') id: string, @Query('type') type: 'urgent' | 'planned' = 'urgent') {
    return this.admin.candidates(id, type);
  }

  @Get(':id')
  detail(@Param('id') id: string, @Query('type') type: 'urgent' | 'planned' = 'urgent') {
    return this.admin.detail(id, type);
  }

  @Post(':id/assign')
  assign(
    @CurrentUser() operator: User,
    @Param('id') id: string,
    @Body() dto: AssignOrderDto,
    @Query('type') type: 'urgent' | 'planned' = 'urgent',
  ) {
    if (type === 'planned') {
      throw new BadRequestException('Ручное назначение недоступно для плановых заказов');
    }
    return this.orders.manualAssign(operator.id, id, dto.masterUserId);
  }
}
