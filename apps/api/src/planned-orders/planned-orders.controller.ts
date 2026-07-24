import { Body, Controller, Get, NotFoundException, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
import { createReadStream } from 'fs';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { mimeTypeForStoredPath } from '../storage/upload-security';
import { PlannedOrdersService } from './planned-orders.service';
import { PlannedOrdersCommercialService } from './planned-orders-commercial.service';
import { CreatePlannedOrderDto, PlaceBidDto, SelectBidDto } from './dto';

@Controller('planned-orders')
@UseGuards(JwtAuthGuard)
export class PlannedOrdersController {
  constructor(
    private readonly plannedOrders: PlannedOrdersService,
    private readonly commercial: PlannedOrdersCommercialService,
  ) {}

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

  @Get(':id/photos/:photoId')
  async photo(@CurrentUser() user: User, @Param('id') id: string, @Param('photoId') photoId: string) {
    const absPath = await this.plannedOrders.getPhotoStream(user, id, photoId);
    const mimeType = mimeTypeForStoredPath(absPath);
    if (!mimeType || mimeType === 'application/pdf') throw new NotFoundException('Фото не найдено');
    return new StreamableFile(createReadStream(absPath), { type: mimeType, disposition: 'inline' });
  }

  @Post(':id/bids')
  placeBid(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: PlaceBidDto) {
    return this.commercial.placeBid(user.id, id, dto);
  }

  @Post(':id/select')
  select(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: SelectBidDto) {
    return this.plannedOrders.select(user.id, id, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.confirm(user.id, id);
  }

  @Post(':id/decline')
  decline(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.decline(user.id, id);
  }

  @Post(':id/on-site')
  onSite(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.onSite(user.id, id);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.complete(user.id, id);
  }

  @Post(':id/confirm-completion')
  confirmCompletion(@CurrentUser() user: User, @Param('id') id: string) {
    return this.plannedOrders.confirmCompletion(user.id, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.commercial.cancel(user, id);
  }
}
