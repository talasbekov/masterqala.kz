import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp,resetDb,seedCategories,loginAs,createActiveMaster,createOrderViaApi,pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Direct quote and explicit acceptance (e2e)',()=>{
  let app:INestApplication;
  const previous=process.env.COMMERCIAL_MODE;
  beforeAll(async()=>{process.env.COMMERCIAL_MODE='DIRECT_PAYMENT';app=await createTestApp();});
  afterAll(async()=>{await app?.close();if(previous===undefined)delete process.env.COMMERCIAL_MODE;else process.env.COMMERCIAL_MODE=previous;});
  beforeEach(async()=>resetDb(app));
  it('versions quotes, waits for master start, and never auto-accepts work or records payment',async()=>{
    const {plumbing}=await seedCategories(app),client=await loginAs(app,'+77073000001');
    const master=await createActiveMaster(app,'+77073000002',plumbing.id,pointAtKm(1));
    const stranger=await loginAs(app,'+77073000003');
    const order=await createOrderViaApi(app,client.token,plumbing.id);
    const post=(token:string,action:string,body:object={})=>request(app.getHttpServer()).post(`/api/v1/orders/${order.id}/${action}`).set('Authorization',`Bearer ${token}`).send(body);
    await app.get(MatchingService).handleWave({orderId:order.id,wave:1});
    await post(master.token,'accept').expect(201);
    await post(master.token,'on-way').expect(201);
    await post(master.token,'on-way').expect(201);
    await post(master.token,'on-site').expect(201);
    const quote={amount:8000,materialsPrice:3500,calloutPrice:2500,comment:'Replace pipe',expectedQuoteVersion:0};
    let response=await post(master.token,'propose-price',quote).expect(201);
    expect(response.body).toMatchObject({quoteTotal:14000,quoteVersion:1,priceDeadline:null});
    await post(master.token,'propose-price',quote).expect(201);
    await post(stranger.token,'confirm-price',{quoteVersion:1}).expect(403);
    await post(client.token,'confirm-price',{quoteVersion:1}).expect(201);
    await post(client.token,'confirm-price',{quoteVersion:1}).expect(201);
    response=await post(master.token,'propose-price',{...quote,amount:9000,expectedQuoteVersion:1}).expect(201);
    expect(response.body).toMatchObject({quoteVersion:2,consentedVersion:null,status:'AWAITING_PRICE_CONFIRM'});
    await post(client.token,'confirm-price',{quoteVersion:1}).expect(409);
    await post(master.token,'start-work',{quoteVersion:2}).expect(409);
    await post(client.token,'confirm-price',{quoteVersion:2}).expect(201);
    await post(master.token,'complete').expect(409);
    await post(client.token,'start-work',{quoteVersion:2}).expect(403);
    await post(master.token,'start-work',{quoteVersion:2}).expect(201);
    await post(master.token,'start-work',{quoteVersion:2}).expect(201);
    await post(master.token,'complete').expect(201);
    await app.get(OrdersService).handleAutoClose({orderId:order.id});
    const prisma=app.get(PrismaService);
    expect((await prisma.order.findUniqueOrThrow({where:{id:order.id}})).status).toBe('DONE');
    const active=await request(app.getHttpServer()).get('/api/v1/master/active-order').set('Authorization',`Bearer ${master.token}`).expect(200);
    expect(active.body.order?.id).toBe(order.id);
    await post(client.token,'confirm-completion').expect(201);
    await post(client.token,'confirm-completion').expect(201);
    expect(await prisma.paymentTransaction.count({where:{orderId:order.id}})).toBe(0);
    expect(await prisma.accrual.count({where:{orderId:order.id}})).toBe(0);
  });

  it.each([false,true])('cancels from the current server departure state (%s)',async(departed)=>{
    const {plumbing}=await seedCategories(app),client=await loginAs(app,departed?'+77073000011':'+77073000021');
    const master=await createActiveMaster(app,departed?'+77073000012':'+77073000022',plumbing.id,pointAtKm(1));
    const order=await createOrderViaApi(app,client.token,plumbing.id);
    const post=(token:string,action:string,body:object={})=>request(app.getHttpServer()).post(`/api/v1/orders/${order.id}/${action}`).set('Authorization',`Bearer ${token}`).send(body);
    const preview=()=>request(app.getHttpServer()).get(`/api/v1/orders/${order.id}/cancellation-preview`).set('Authorization',`Bearer ${client.token}`).expect(200);
    await app.get(MatchingService).handleWave({orderId:order.id,wave:1});await post(master.token,'accept').expect(201);
    const before=await preview();expect(before.body.amount).toBe(0);
    if(departed){await post(master.token,'on-way').expect(201);await post(master.token,'on-site').expect(201);
      await post(client.token,'cancel',{expectedAmount:0,expectedUpdatedAt:before.body.expectedUpdatedAt}).expect(409);}
    const current=await preview();expect(current.body.amount).toBe(departed?2500:0);
    const body={expectedAmount:current.body.amount,expectedUpdatedAt:current.body.expectedUpdatedAt};
    const cancelled=await post(client.token,'cancel',body).expect(201);expect(cancelled.body.cancellationAmount).toBe(departed?2500:0);
    await post(client.token,'cancel',body).expect(201);
    expect(await app.get(PrismaService).paymentTransaction.count({where:{orderId:order.id}})).toBe(0);
  });
});
