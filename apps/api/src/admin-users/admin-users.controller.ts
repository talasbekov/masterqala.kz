import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminUsersService } from './admin-users.service';
import { BlockUserDto } from './dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminUsersController {
  constructor(private readonly admin: AdminUsersService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.admin.list(search);
  }

  @Post(':id/block')
  block(@CurrentUser() operator: User, @Param('id') id: string, @Body() dto: BlockUserDto) {
    return this.admin.block(operator.id, id, dto.reason);
  }

  @Post(':id/unblock')
  unblock(@CurrentUser() operator: User, @Param('id') id: string) {
    return this.admin.unblock(operator.id, id);
  }
}
