import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createOrderViaApi, ALMATY } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Direct urgent order contract (e2e)', () => {
  let app: INestApplication;
  const previousMode = process.env.COMMERCIAL_MODE;
  beforeAll(async () => { process.env.COMMERCIAL_MODE = 'DIRECT_PAYMENT'; app = await createTestApp(); });
  afterAll(async () => {
    await app?.close();
    if (previousMode === undefined) delete process.env.COMMERCIAL_MODE;
    else process.env.COMMERCIAL_MODE = previousMode;
  });
  beforeEach(async () => resetDb(app));

  it('accepts a request without a nearby master and does not collect platform money', async () => {
    const {plumbing} = await seedCategories(app);
    const client = await loginAs(app, '+77071000001');
    const order = await createOrderViaApi(app, client.token, plumbing.id);
    expect(order).toMatchObject({ commercialMode: 'DIRECT_PAYMENT', lifecycleVersion: 2,
      dispatchMode: 'SEQUENTIAL', status: 'SEARCHING', serviceFee: 0, quoteVersion: 0,
      consentedVersion: null, departedAt: null });
    const prisma = app.get(PrismaService);
    expect(await prisma.paymentTransaction.count({where: {orderId: order.id}})).toBe(0);
    expect(await prisma.accrual.count({where: {orderId: order.id}})).toBe(0);
    const preview = await request(app.getHttpServer()).post('/api/v1/orders/preview')
      .set('Authorization', `Bearer ${client.token}`).send({categoryId: plumbing.id, ...ALMATY}).expect(201);
    expect(preview.body).toMatchObject({commercialMode: 'DIRECT_PAYMENT', quoteRequired: true, serviceFee: 0});
  });

  it('does not rewrite the financial contract of an existing legacy order', async () => {
    const {plumbing} = await seedCategories(app);
    const client = await loginAs(app, '+77071000002');
    const prisma = app.get(PrismaService);
    const legacy = await prisma.order.create({data: {clientId: client.userId, categoryId: plumbing.id,
      description:'Old order', address:'Old address', district:'Esil', calloutPrice: 3200, serviceFee: 1280,
      commercialMode:'PAID_MOCK', status:'CLOSED'}});
    const response = await request(app.getHttpServer()).get(`/api/v1/orders/${legacy.id}`)
      .set('Authorization', `Bearer ${client.token}`).expect(200);
    expect(response.body).toMatchObject({commercialMode:'PAID_MOCK', lifecycleVersion:1,
      dispatchMode:'WAVE', calloutPrice:3200, serviceFee:1280});
    expect(await prisma.order.findUnique({where:{id:legacy.id}})).toEqual(legacy);
  });
});
