import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlannedOrdersService } from './planned-orders.service';
import { CreatePlannedOrderDto } from './dto';

@Controller('planned-orders')
@UseGuards(JwtAuthGuard)
export class PlannedOrdersController {
  constructor(private readonly plannedOrders: PlannedOrdersService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreatePlannedOrderDto) {
    return this.plannedOrders.create(user.id, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: User) {
    return this.plannedOrders.listMine(user.id);
  }
}
