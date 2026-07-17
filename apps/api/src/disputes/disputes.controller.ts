import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DisputesService } from './disputes.service';
import { OpenDisputeDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post('orders/:id/disputes')
  openForOrder(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openForOrder(user, id, dto);
  }

  @Post('planned-orders/:id/disputes')
  openForPlannedOrder(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openForPlannedOrder(user, id, dto);
  }
}
