import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createPlannedOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Лента и просмотр плановой заявки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let electricsId: string;
  let client: { token: string; userId: string };
  let plumber: { token: string; userId: string };
  let electrician: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const cats = await seedCategories(app);
    plumbingId = cats.plumbing.id;
    electricsId = cats.electrics.id;
    client = await loginAs(app, '+77070000001');
    plumber = await createActiveMaster(app, '+77070000002', plumbingId);
    electrician = await createActiveMaster(app, '+77070000003', electricsId);
  });

  it('лента фильтруется по категории мастера, без адреса и контакта клиента', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);

    const plumberFeed = await request(app.getHttpServer())
      .get('/api/v1/planned-orders/feed')
      .set('Authorization', `Bearer ${plumber.token}`)
      .expect(200);
    expect(plumberFeed.body).toHaveLength(1);
    expect(plumberFeed.body[0].id).toBe(order.id);
    expect(plumberFeed.body[0].address).toBeUndefined();

    const electricianFeed = await request(app.getHttpServer())
      .get('/api/v1/planned-orders/feed')
      .set('Authorization', `Bearer ${electrician.token}`)
      .expect(200);
    expect(electricianFeed.body).toHaveLength(0);
  });

  it('чужой мастер видит заявку без адреса и контакта клиента', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const redacted = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${plumber.token}`)
      .expect(200);
    expect(redacted.body.address).toBeNull();
    expect(redacted.body.client).toBeNull();
    expect(redacted.body.bids).toEqual([]);
  });

  it('выбранный мастер видит адрес и контакт клиента; чужой мастер — по-прежнему нет', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const anotherPlumber = await createActiveMaster(app, '+77070000004', plumbingId);

    await prisma.plannedOrder.update({
      where: { id: order.id },
      data: { masterId: plumber.userId },
    });

    const revealed = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${plumber.token}`)
      .expect(200);
    expect(revealed.body.address).toBe('ул. Абая, 1');
    expect(revealed.body.client).toMatchObject({
      id: client.userId,
      phone: '+77070000001',
    });

    const stillRedacted = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${anotherPlumber.token}`)
      .expect(200);
    expect(stillRedacted.body.address).toBeNull();
    expect(stillRedacted.body.client).toBeNull();
    expect(stillRedacted.body.master).toMatchObject({ id: plumber.userId, phone: '' });
    expect(stillRedacted.body.bids).toEqual([]);
  });

  it('клиент видит свою заявку полностью', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId);
    const full = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(full.body.address).toBe('ул. Абая, 1');
  });
});
