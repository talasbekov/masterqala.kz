import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { SecurityAlertQueryDto, SecurityAlertTransitionDto } from './security-observability.dto';
import { SecurityObservabilityService } from './security-observability.service';

@Controller('admin/security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class SecurityObservabilityController {
  constructor(private readonly observability: SecurityObservabilityService) {}

  @Get('dashboard')
  dashboard() {
    return this.observability.dashboard();
  }

  @Get('alerts')
  alerts(@Query() query: SecurityAlertQueryDto) {
    return this.observability.list(query);
  }

  @Patch('alerts/:id')
  transition(
    @CurrentUser() operator: User,
    @Param('id') id: string,
    @Body() dto: SecurityAlertTransitionDto,
  ) {
    return this.observability.transition(operator.id, id, dto);
  }
}
