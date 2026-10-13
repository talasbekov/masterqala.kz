import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { JOBS } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ACTIVE_MASTER_STATUSES } from './order.constants';

const active = Prisma.join(ACTIVE_MASTER_STATUSES.map(status => Prisma.sql`${status}::"OrderStatus"`));
export interface SequentialTimeout { orderId: string; attempt: number; offerId: string; }

/** Persisted deadlines + row locks make redelivery/recovery independent of browser timers. */
@Injectable()
export class SequentialMatchingService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly queue: QueueService,
    private readonly gateway: RealtimeGateway) {}

  onModuleInit() {
    this.queue.register(JOBS.SEQUENTIAL_DISPATCH, (data: {orderId:string;attempt?:number}) => this.dispatch(data.orderId,data.attempt));
    this.queue.register(JOBS.SEQUENTIAL_TIMEOUT, (data: SequentialTimeout) => this.timeout(data));
    this.queue.registerCron(JOBS.SEQUENTIAL_RECOVERY, '* * * * *', () => this.recover());
  }

  async recover() {
    const orders = await this.prisma.order.findMany({where:{dispatchMode:'SEQUENTIAL',status:'SEARCHING'},select:{id:true,searchAttempt:true}});
    for (const order of orders) await this.dispatch(order.id,order.searchAttempt);
  }

  async timeout(data: SequentialTimeout) {
    const offer=await this.prisma.orderOffer.findUnique({where:{id:data.offerId}});
    if (!offer || offer.orderId!==data.orderId || offer.attempt!==data.attempt || offer.outcome!=='PENDING') return;
    // Early/duplicate delivery must not expire a current offer prematurely.
    await this.dispatch(data.orderId,data.attempt);
  }

  async dispatch(orderId: string, attempt?: number): Promise<void> {
    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
      const order=await tx.order.findUnique({where:{id:orderId},include:{category:true}});
      if(!order || order.status!=='SEARCHING' || order.dispatchMode!=='SEQUENTIAL' || (attempt!==undefined && order.searchAttempt!==attempt)) return null;
      const now=new Date();
      const pending=await tx.orderOffer.findFirst({where:{orderId,attempt:order.searchAttempt,outcome:'PENDING',sequential:true}});
      if(pending?.expiresAt && pending.expiresAt>now) return {order,offer:pending,expired:null,deferred:false};
      if(pending) await tx.orderOffer.update({where:{id:pending.id},data:{outcome:'EXPIRED',respondedAt:now}});
      // User row lock also serializes accept/manual assignment of DIFFERENT orders.
      const eligibleQuery=Prisma.sql`
        SELECT u.id,ST_Distance(mp.location,o.location) AS meters
        FROM "User" u JOIN "MasterPresence" mp ON mp."masterUserId"=u.id
        JOIN "MasterProfile" pr ON pr."userId"=u.id
        JOIN "MasterCategory" mc ON mc."masterProfileId"=pr.id AND mc."categoryId"=${order.categoryId}
        JOIN "Order" o ON o.id=${orderId}
        WHERE mp."isOnline"=true AND u."isBlocked"=false AND pr.status='ACTIVE'
          AND (pr."blockedUntil" IS NULL OR pr."blockedUntil"<now()) AND u.id<>${order.clientId}
          AND mp.location IS NOT NULL AND o.location IS NOT NULL AND ST_DWithin(mp.location,o.location,10000)
          AND NOT EXISTS(SELECT 1 FROM "Order" busy WHERE busy."masterId"=u.id AND (busy.status IN (${active}) OR (busy."lifecycleVersion">=2 AND busy.status='DONE')))
          AND NOT EXISTS(SELECT 1 FROM "PlannedOrder" busy WHERE busy."masterId"=u.id AND busy.status='IN_PROGRESS')
          AND NOT EXISTS(SELECT 1 FROM "OrderOffer" offered WHERE offered."orderId"=${orderId} AND offered."masterUserId"=u.id AND (offered.attempt=${order.searchAttempt} OR offered.outcome='ACCEPTED'))
          AND NOT EXISTS(SELECT 1 FROM "OrderOffer" other WHERE other."masterUserId"=u.id AND other.outcome='PENDING' AND other.sequential=true AND other."expiresAt">now())
        ORDER BY meters ASC,u.id ASC LIMIT 1`;
      const candidates=await tx.$queryRaw<{id:string;meters:number}[]>(Prisma.sql`${eligibleQuery} FOR UPDATE OF u SKIP LOCKED`);
      if(!candidates.length) {
        // SKIP LOCKED is temporary contention, not proof that eligibility is exhausted.
        // Reuse every predicate/ordering without waiting for the skipped row lock.
        const eligible=await tx.$queryRaw<{id:string;meters:number}[]>(eligibleQuery);
        if(eligible.length)return {order,offer:null,expired:pending,deferred:true};
        await tx.order.update({where:{id:orderId},data:{status:'NO_MASTERS'}});
        return {order,offer:null,expired:pending,deferred:false};
      }
      const candidate=candidates[0];
      const sentAt=new Date();
      const offer=await tx.orderOffer.create({data:{orderId,masterUserId:candidate.id,attempt:order.searchAttempt,
        wave:1,sequential:true,distanceKm:Math.round(candidate.meters/1000*10)/10,sentAt,expiresAt:new Date(sentAt.getTime()+30000)}});
      return {order,offer,expired:pending,deferred:false};
    });
    if(!result) return;
    if(result.expired) this.gateway.emitToUser(result.expired.masterUserId,'offer:closed',{orderId,offerId:result.expired.id,reason:'Время на принятие истекло'});
    if(result.offer) {
      const {offer,order}=result;
      this.gateway.emitToUser(offer.masterUserId,'offer:new',{orderId,offerId:offer.id,category:order.category.name,
        description:order.description,district:order.district,commercialMode:'DIRECT_PAYMENT',directPayment:true,
        compensation:0,freePilot:false,distanceKm:offer.distanceKm,deadline:offer.expiresAt!.toISOString(),wave:1});
      await this.queue.send(JOBS.SEQUENTIAL_TIMEOUT,{orderId,attempt:offer.attempt,offerId:offer.id},Math.max(0,(offer.expiresAt!.getTime()-Date.now())/1000));
    }
    this.gateway.emitToUser(result.order.clientId,'order:status',{orderId,status:result.offer||result.deferred?'SEARCHING':'NO_MASTERS'});
  }
}
