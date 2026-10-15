import { storedQuoteTotal } from './quote-amount';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProposePriceDto, CancelOrderDto } from './dto';

const MAX_AMOUNT=2147483647;
const afterStart=['IN_PROGRESS','DONE','CLOSED'];
function requireCompleteQuote(order: Order) {
  if (storedQuoteTotal(order) === null) {
    throw new ConflictException('Согласованная сумма недоступна. Обновите заказ.');
  }
}
function conflict() { throw new ConflictException('Состояние или версия заказа изменились. Обновите заказ.'); }

@Injectable()
export class DirectOrderLifecycleService {
  constructor(private readonly prisma:PrismaService) {}

  private async change(userId:string,id:string,actor:'client'|'master',action:(order:Order,tx:Prisma.TransactionClient)=>Promise<Prisma.OrderUncheckedUpdateInput|null>|Prisma.OrderUncheckedUpdateInput|null) {
    return this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id} FOR UPDATE`;
      const order=await tx.order.findUnique({where:{id}});
      if(!order) throw new NotFoundException('Заявка не найдена');
      if((actor==='client'?order.clientId:order.masterId)!==userId) throw new ForbiddenException('Нет доступа к заявке');
      if(order.lifecycleVersion<2 || order.commercialMode!=='DIRECT_PAYMENT') conflict();
      const data=await action(order,tx);
      return data?tx.order.update({where:{id},data}):order;
    });
  }

  onWay(userId:string,id:string) {
    return this.change(userId,id,'master',order=>{
      if(order.departedAt) return null;
      if(order.status!=='ACCEPTED') conflict();
      return {status:'MASTER_ON_WAY',departedAt:new Date()};
    });
  }

  onSite(userId:string,id:string) {
    return this.change(userId,id,'master',order=>{
      if(order.onSiteAt) return null;
      if(order.status!=='MASTER_ON_WAY' || !order.departedAt) conflict();
      return {status:'INSPECTION',onSiteAt:new Date()};
    });
  }

  propose(userId:string,id:string,dto:ProposePriceDto) {
    return this.change(userId,id,'master',order=>{
      const {amount,expectedQuoteVersion}=dto;
      const materials=dto.materialsPrice??0;
      const callout=dto.calloutPrice;
      if(callout===undefined || expectedQuoteVersion===undefined) throw new BadRequestException('Передайте стоимость выезда и ожидаемую версию сметы');
      if(![amount,materials,callout].every(n=>Number.isInteger(n)&&n>=0&&n<=MAX_AMOUNT) || amount+materials+callout>MAX_AMOUNT || amount+materials+callout<=0) throw new BadRequestException('Некорректная сумма сметы');
      const comment=dto.comment??null;
      if(order.quoteVersion===expectedQuoteVersion+1 && order.workPrice===amount && order.materialsPrice===materials && order.calloutPrice===callout && order.workComment===comment) return null;
      if(order.quoteVersion!==expectedQuoteVersion || !['INSPECTION','AWAITING_PRICE_CONFIRM','PRICE_APPROVED'].includes(order.status)) conflict();
      return {status:'AWAITING_PRICE_CONFIRM',workPrice:amount,materialsPrice:materials,calloutPrice:callout,serviceFee:0,
        workComment:comment,priceProposedAt:new Date(),quoteVersion:order.quoteVersion+1,consentedVersion:null,quoteApprovedAt:null};
    });
  }

  approve(userId:string,id:string,quoteVersion?:number) {
    return this.change(userId,id,'client',order=>{
      if(!Number.isInteger(quoteVersion) || !quoteVersion || order.quoteVersion!==quoteVersion) conflict();
      if(order.consentedVersion===quoteVersion && ['PRICE_APPROVED',...afterStart].includes(order.status)) return null;
      if(order.status!=='AWAITING_PRICE_CONFIRM') conflict();
      requireCompleteQuote(order);
      return {status:'PRICE_APPROVED',consentedVersion:quoteVersion,quoteApprovedAt:new Date()};
    });
  }

  start(userId:string,id:string,quoteVersion?:number) {
    return this.change(userId,id,'master',order=>{
      if(!quoteVersion || order.quoteVersion!==quoteVersion || order.consentedVersion!==quoteVersion) conflict();
      if(order.workStartedAt && afterStart.includes(order.status)) return null;
      if(order.status!=='PRICE_APPROVED') conflict();
      requireCompleteQuote(order);
      return {status:'IN_PROGRESS',workStartedAt:new Date()};
    });
  }

  complete(userId:string,id:string) {
    return this.change(userId,id,'master',order=>{
      if(['DONE','CLOSED'].includes(order.status)) return null;
      if(order.status!=='IN_PROGRESS' || !order.workStartedAt || order.consentedVersion!==order.quoteVersion) conflict();
      return {status:'DONE',completedAt:new Date()};
    });
  }

  acceptResult(userId:string,id:string) {
    return this.change(userId,id,'client',order=>{
      if(order.status==='CLOSED') return null;
      if(order.status!=='DONE') conflict();
      requireCompleteQuote(order);
      return {status:'CLOSED',closedAt:new Date()};
    });
  }
  private cancellationAmount(order:Order):number {
    if(order.status==='CANCELLED_BY_CLIENT') return order.cancellationAmount??0;
    if(!['CREATED','SEARCHING','NO_MASTERS','ACCEPTED','MASTER_ON_WAY','INSPECTION','AWAITING_PRICE_CONFIRM','PRICE_APPROVED'].includes(order.status)) conflict();
    return order.departedAt?2500:0;
  }

  async cancellationPreview(userId:string,id:string) {
    const order=await this.change(userId,id,'client',()=>null);
    return {orderId:id,amount:this.cancellationAmount(order),currency:'KZT',expectedUpdatedAt:order.updatedAt.toISOString()};
  }

  cancel(userId:string,id:string,dto:CancelOrderDto) {
    return this.change(userId,id,'client',async(order,tx)=>{
      if(order.status==='CANCELLED_BY_CLIENT') return null;
      const amount=this.cancellationAmount(order);
      if(dto.expectedAmount===undefined || !dto.expectedUpdatedAt) throw new BadRequestException('Подтвердите актуальные условия отмены');
      if(dto.expectedAmount!==amount || dto.expectedUpdatedAt!==order.updatedAt.toISOString()) conflict();
      await tx.orderOffer.updateMany({where:{orderId:id,outcome:'PENDING'},data:{outcome:'EXPIRED',respondedAt:new Date()}});
      return {status:'CANCELLED_BY_CLIENT',cancelReason:dto.reason??'Отменена клиентом',cancellationAmount:amount};
    });
  }

}
