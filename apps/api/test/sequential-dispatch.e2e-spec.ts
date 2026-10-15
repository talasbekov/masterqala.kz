import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi, pointAtKm } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

describe('Sequential dispatch (e2e)', () => {
  let app: INestApplication;
  const previousMode = process.env.COMMERCIAL_MODE;
  beforeAll(async () => {process.env.COMMERCIAL_MODE='DIRECT_PAYMENT'; app=await createTestApp();});
  afterAll(async () => {await app?.close(); if(previousMode===undefined) delete process.env.COMMERCIAL_MODE;else process.env.COMMERCIAL_MODE=previousMode;});
  beforeEach(async () => resetDb(app));

  it('offers only the nearest master for 30 seconds, safely redelivers, then advances', async () => {
    const {plumbing}=await seedCategories(app);
    const client=await loginAs(app,'+77072000001');
    const nearest=await createActiveMaster(app,'+77072000002',plumbing.id,pointAtKm(1));
    const next=await createActiveMaster(app,'+77072000003',plumbing.id,pointAtKm(2));
    const order=await createOrderViaApi(app,client.token,plumbing.id);
    const matching=app.get(MatchingService), prisma=app.get(PrismaService);
    await Promise.all([matching.handleWave({orderId:order.id,wave:1}),matching.handleWave({orderId:order.id,wave:1})]);
    let offers=await prisma.orderOffer.findMany({where:{orderId:order.id},orderBy:{sentAt:'asc'}});
    expect(offers).toHaveLength(1);
    expect(offers[0].masterUserId).toBe(nearest.userId);
    const restored=await request(app.getHttpServer()).get('/api/v1/master/pending-offer').set('Authorization',`Bearer ${nearest.token}`).expect(200);
    expect(restored.body.offer).toMatchObject({offerId:offers[0].id,deadline:offers[0].expiresAt!.toISOString(),directPayment:true});
    const unrelated=await request(app.getHttpServer()).get('/api/v1/master/pending-offer').set('Authorization',`Bearer ${client.token}`).expect(200);
    expect(unrelated.body).toEqual({offer:null});

    expect(offers[0].expiresAt!.getTime()-offers[0].sentAt.getTime()).toBeGreaterThan(29000);
    expect(offers[0].expiresAt!.getTime()-offers[0].sentAt.getTime()).toBeLessThanOrEqual(30000);
    await prisma.orderOffer.update({where:{id:offers[0].id},data:{expiresAt:new Date(Date.now()-1000)}});
    await request(app.getHttpServer()).post(`/api/v1/orders/${order.id}/accept`).set('Authorization',`Bearer ${nearest.token}`).send({}).expect(409);
    await matching.handleWave({orderId:order.id,wave:1});
    offers=await prisma.orderOffer.findMany({where:{orderId:order.id},orderBy:{sentAt:'asc'}});
    expect(offers).toHaveLength(2);
    expect(offers[0].outcome).toBe('EXPIRED');
    expect(offers[1]).toMatchObject({masterUserId:next.userId,outcome:'PENDING'});
    await request(app.getHttpServer()).post(`/api/v1/orders/${order.id}/accept`).set('Authorization',`Bearer ${next.token}`).send({}).expect(201);
    expect(await prisma.paymentTransaction.count({where:{orderId:order.id}})).toBe(0);
  });

  it('declining an offer moves directly to the next master without penalties', async () => {
    const {plumbing}=await seedCategories(app);
    const client=await loginAs(app,'+77072000021');
    const m1=await createActiveMaster(app,'+77072000022',plumbing.id,pointAtKm(1));
    const m2=await createActiveMaster(app,'+77072000023',plumbing.id,pointAtKm(2));
    const order=await createOrderViaApi(app,client.token,plumbing.id);
    const matching=app.get(MatchingService),prisma=app.get(PrismaService);
    await matching.handleWave({orderId:order.id,wave:1});
    await request(app.getHttpServer()).post(`/api/v1/orders/${order.id}/decline`).set('Authorization',`Bearer ${m1.token}`).send({}).expect(201);
    await matching.handleWave({orderId:order.id,wave:1});
    expect(await prisma.orderOffer.findFirst({where:{orderId:order.id,outcome:'PENDING'}})).toMatchObject({masterUserId:m2.userId});
    expect(await prisma.masterCancellation.count()).toBe(0);
  });

  it('never assigns one master to two different orders concurrently', async () => {
    const {plumbing}=await seedCategories(app);
    const client1=await loginAs(app,'+77072000011'),client2=await loginAs(app,'+77072000012');
    const master=await createActiveMaster(app,'+77072000013',plumbing.id,pointAtKm(1));
    const order1=await createOrderViaApi(app,client1.token,plumbing.id),order2=await createOrderViaApi(app,client2.token,plumbing.id);
    const prisma=app.get(PrismaService);
    // Deliberately concurrent eligible offers exercise acceptance independently from dispatcher filtering.
    await prisma.orderOffer.createMany({data:[order1,order2].map(order=>({orderId:order.id,masterUserId:master.userId,wave:1,attempt:1,sequential:true,expiresAt:new Date(Date.now()+30000)}))});
    const responses=await Promise.all([order1,order2].map(order=>request(app.getHttpServer()).post(`/api/v1/orders/${order.id}/accept`).set('Authorization',`Bearer ${master.token}`).send({})));
    expect(responses.map(r=>r.status).sort()).toEqual([201,409]);
    expect(await prisma.order.count({where:{masterId:master.userId,status:'ACCEPTED'}})).toBe(1);
  });
});
