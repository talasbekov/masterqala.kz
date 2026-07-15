import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto, PreviewOrderDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('orders/preview')
  preview(@Body() dto: PreviewOrderDto) {
    return this.orders.preview(dto);
  }

  @Post('orders')
  create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto);
  }

  @Get('orders/active')
  getActive(@CurrentUser() user: User) {
    return this.orders.getActive(user.id);
  }

  @Get('orders')
  listMine(@CurrentUser() user: User) {
    return this.orders.listMine(user.id);
  }

  @Get('orders/:id')
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.getById(user, id);
  }

  @Get('master/active-order')
  getMasterActive(@CurrentUser() user: User) {
    return this.orders.getMasterActive(user.id);
  }

  @Post('orders/:id/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.accept(user.id, id);
  }
}
