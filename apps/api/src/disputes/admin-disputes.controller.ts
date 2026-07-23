import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { DisputeStatus, User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { DisputesService } from './disputes.service';
import { ResolveDisputeDto } from './dto';

@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OPERATOR')
export class AdminDisputesController {
  constructor(
    private readonly disputes: DisputesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@Query('status', new ParseEnumPipe(DisputeStatus, { optional: true })) status?: DisputeStatus) {
    return this.disputes.listAll(status);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const dispute = await this.disputes.getById(id);
    const target = dispute.orderId
      ? await this.prisma.order.findUnique({ where: { id: dispute.orderId }, select: { commercialMode: true } })
      : dispute.plannedOrderId
        ? await this.prisma.plannedOrder.findUnique({
            where: { id: dispute.plannedOrderId },
            select: { commercialMode: true },
          })
        : null;
    return { ...dispute, commercialMode: target?.commercialMode ?? null };
  }

  @Post(':id/resolve')
  resolve(@CurrentUser() operator: User, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.disputes.resolve(operator.id, id, dto);
  }
}
