import { Body, Controller, Get, NotFoundException, Param, Post, StreamableFile, UseGuards, Res, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import type {Response} from 'express';
import {OrderCreationRequestService,type CreationRequestRecord} from './order-creation-request.service';
import { createReadStream } from 'fs';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CommercialModeService } from '../commercial-mode/commercial-mode.service';
import { PhotoReferenceGuard } from '../storage/photo-reference.guard';
import { mimeTypeForStoredPath } from '../storage/upload-security';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateIdempotentOrderDto, PreviewOrderDto, ProposePriceDto, QuoteVersionDto, CancelOrderDto } from './dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly commercialMode: CommercialModeService,
    private readonly photoReferences: PhotoReferenceGuard,
    private readonly creationRequests?: OrderCreationRequestService,
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

  @Get('master/pending-offer')
  async pendingOffer(@CurrentUser() user:User){return {offer:await this.orders.pendingOffer(user.id)};}

  @Post('orders/preview')
  preview(@CurrentUser() user: User, @Body() dto: PreviewOrderDto) {
    return this.present(this.orders.preview(user.id, dto));
  }

  private async replayCreate(user:User,record:CreationRequestRecord,response?:Response) {
    response?.setHeader('Idempotency-Replayed','true');
    if(record.successfulResponse!==null&&record.successfulResponse!==undefined)return record.successfulResponse;
    // The order is committed, but a successful presented snapshot is not yet recorded.
    // Never treat this as a failed create or repeat payment/dispatch effects.
    response?.status(202);
    return {...await this.present(this.orders.getById(user,record.orderId)),creationProcessing:true};
  }

  @Post('orders/idempotent')
  async createIdempotent(@CurrentUser() user:User,@Body() dto:CreateIdempotentOrderDto,@Res({passthrough:true}) response?:Response){
    if(!dto.clientRequestId)throw new BadRequestException('clientRequestId required');
    return this.create(user,dto,response);
  }

  @Post('orders')
  async create(@CurrentUser() user: User, @Body() dto: CreateOrderDto, @Res({passthrough:true}) response?:Response) {
    if(!dto.clientRequestId){
      await this.photoReferences.assertAvailable(user.id,dto.photoPaths);
      return this.present(this.orders.create(user.id,dto));
    }
    if(!this.creationRequests)throw new InternalServerErrorException('Request identity service unavailable');
    const previous=await this.creationRequests.lookup(user.id,dto);
    if(previous)return this.replayCreate(user,previous,response);
    try {
      await this.photoReferences.assertAvailable(user.id,dto.photoPaths);
      const created=await this.orders.createWithRequest(user.id,dto);
      if(created.replayed){
        const record=await this.creationRequests.lookup(user.id,dto);
        if(!record)throw new InternalServerErrorException('Committed request identity unavailable');
        return this.replayCreate(user,record,response);
      }
      const presented=await this.present(created.order);
      return await this.creationRequests.rememberResponse(user.id,dto,presented);
    }catch(error){
      // Recover only an exact committed owner/key, never by matching order fields.
      const committed=await this.creationRequests.lookup(user.id,dto);
      if(committed)return this.replayCreate(user,committed,response);
      throw error;
    }
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
    const mimeType = mimeTypeForStoredPath(absPath);
    if (!mimeType || mimeType === 'application/pdf') throw new NotFoundException('Фото не найдено');
    return new StreamableFile(createReadStream(absPath), { type: mimeType, disposition: 'inline' });
  }

  @Get('master/active-order')
  getMasterActive(@CurrentUser() user: User) {
    return this.present(this.orders.getMasterActive(user.id));
  }

  @Post('orders/:id/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.accept(user.id, id));
  }

  @Post('orders/:id/decline')
  decline(@CurrentUser() user: User, @Param('id') id: string) { return this.orders.declineOffer(user.id,id); }

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
  confirmPrice(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: QuoteVersionDto) {
    return this.present(this.orders.confirmPrice(user.id, id, dto));
  }

  @Post('orders/:id/reject-price')
  rejectPrice(@CurrentUser() user: User, @Param('id') id: string,@Body() dto:CancelOrderDto) {
    return this.present(this.orders.rejectPrice(user.id, id,dto));
  }

  @Post('orders/:id/start-work')
  startWork(@CurrentUser() user:User,@Param('id') id:string,@Body() dto:QuoteVersionDto) { return this.present(this.orders.startWork(user.id,id,dto)); }

  @Post('orders/:id/complete')
  complete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.complete(user.id, id));
  }

  @Post('orders/:id/confirm-completion')
  confirmCompletion(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.confirmCompletion(user.id, id));
  }

  @Get('orders/:id/cancellation-preview')
  cancellationPreview(@CurrentUser() user:User,@Param('id') id:string) { return this.orders.cancellationPreview(user,id); }

  @Post('orders/:id/cancel')
  cancel(@CurrentUser() user: User, @Param('id') id: string,@Body() dto:CancelOrderDto) {
    return this.present(this.orders.cancel(user, id,dto));
  }

  @Post('orders/:id/retry-search')
  retrySearch(@CurrentUser() user: User, @Param('id') id: string) {
    return this.present(this.orders.retrySearch(user.id, id));
  }
}
