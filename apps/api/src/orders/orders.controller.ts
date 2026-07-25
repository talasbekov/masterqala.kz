import { Body, Controller, Get, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { createReadStream } from 'fs';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { OrdersService } from './orders.service';
import { CreateOrderDto, PreviewOrderDto, ProposePriceDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly commercialMode: CommercialModeService,
  ) {}

  private async present<T>(value: T | Promise<T>): Promise<T> {
    return this.presentValue(await value);
  }

  private presentValue<T>(value: T): T {
    if (value === null || value === undefined) return value;

    if (Array.isArray(value)) {
      return value.map((item) => this.presentValue(item)) as unknown as T;
    }

    if (typeof value !== 'object') return value;

    const source = value as unknown as Record<string, unknown>;
    const presented: Record<string, unknown> = { ...source };

    if ('order' in source) {
      presented.order = this.presentValue(source.order);
    }

    if (typeof source.calloutPrice === 'number' && typeof source.serviceFee === 'number') {
      const hasStoredMode = typeof source.commercialMode === 'string';
      const freePilot = hasStoredMode
        ? source.commercialMode === 'FREE_PILOT'
        : this.commercialMode.isFreePilot();

      if (freePilot) {
        presented.nominalCalloutPrice = source.calloutPrice;
        presented.nominalServiceFee = source.serviceFee;
        presented.calloutPrice = 0;
        presented.serviceFee = 0;
        presented.freePilot = true;
      }
    }

    return presented as unknown as T;
  }

  @Post('orders/preview')
  preview(@CurrentUser() user: User, @Body() dto: PreviewOrderDto) {
    return this.present(this.orders.preview(user.id, dto));
  }

  @Post('orders')
  create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.present(this.orders.create(user.id, dto));
  }

  @Get('orders/active')
  getActive(@CurrentUser() user: User) {
    return this.present(this.orders.getActive(user.id));
  }

  @Get('orders')
  listMine(@CurrentUser() user: User) {
    return this.present(this.orders.listMine(user.id));
  }

  @Get('orders/:id')
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.getById(user, id));
  }

  @Get('orders/:id/photos/:photoId')
  async photo(@CurrentUser() user: User, @Param('id') id: string, @Param('photoId') photoId: string) {
    const absPath = await this.orders.getPhotoStream(user, id, photoId);
    return new StreamableFile(createReadStream(absPath), { type: 'image/jpeg', disposition: 'inline' });
  }

  @Get('master/active-order')
  getMasterActive(@CurrentUser() user: User) {
    return this.present(this.orders.getMasterActive(user.id));
  }

  @Post('orders/:id/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.accept(user.id, id));
  }

  @Post('orders/:id/on-way')
  onWay(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.onWay(user.id, id));
  }

  @Post('orders/:id/on-site')
  onSite(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.onSite(user.id, id));
  }

  @Post('orders/:id/propose-price')
  proposePrice(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ProposePriceDto) {
    return this.present(this.orders.proposePrice(user.id, id, dto));
  }

  @Post('orders/:id/confirm-price')
  confirmPrice(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.confirmPrice(user.id, id));
  }

  @Post('orders/:id/reject-price')
  rejectPrice(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.rejectPrice(user.id, id));
  }

  @Post('orders/:id/complete')
  complete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.complete(user.id, id));
  }

  @Post('orders/:id/confirm-completion')
  confirmCompletion(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.confirmCompletion(user.id, id));
  }

  @Post('orders/:id/cancel')
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.cancel(user, id));
  }

  @Post('orders/:id/retry-search')
  retrySearch(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.retrySearch(user.id, id));
  }
}
