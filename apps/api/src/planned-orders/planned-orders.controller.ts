import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlannedOrdersService } from './planned-orders.service';
import { CreatePlannedOrderDto, PlaceBidDto } from './dto';

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

  @Get('feed')
  feed(@CurrentUser() user: User) {
    return this.plannedOrders.feed(user.id);
  }

  @Get(':id')
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.getByIdForUser(user, id);
  }

  @Post(':id/bids')
  placeBid(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: PlaceBidDto) {
    return this.plannedOrders.placeBid(user.id, id, dto);
  }
}
