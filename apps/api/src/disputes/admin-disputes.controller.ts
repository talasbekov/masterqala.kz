import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { DisputeStatus, User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DisputesService } from './disputes.service';
import { ResolveDisputeDto } from './dto';

@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  list(@Query('status', new ParseEnumPipe(DisputeStatus, { optional: true })) status?: DisputeStatus) {
    return this.disputes.listAll(status);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.disputes.getById(id);
  }

  @Post(':id/resolve')
  resolve(@CurrentUser() operator: User, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.disputes.resolve(operator.id, id, dto);
  }
}
