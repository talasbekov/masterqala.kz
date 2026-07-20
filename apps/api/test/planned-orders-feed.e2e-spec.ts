import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createPlannedOrderViaApi, grantLeadCredits } from './helpers';
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

  it('мастер без ставки не видит детали адреса и фото до просмотра — только после отклика', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId, {
      photoPaths: ['planned/photo-1.jpg'],
    } as any);
    await prisma.plannedOrder.update({
      where: { id: order.id },
      data: { entrance: '2', floor: '5', apartment: '42', addressComment: 'домофон не работает, звонить заранее' },
    });

    const notBid = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${plumber.token}`)
      .expect(200);
    expect(notBid.body.address).toBeNull();
    expect(notBid.body.entrance).toBeNull();
    expect(notBid.body.floor).toBeNull();
    expect(notBid.body.apartment).toBeNull();
    expect(notBid.body.addressComment).toBeNull();
    expect(notBid.body.photos).toEqual([]);
    // budget остаётся видимым — уже раскрыт публичной лентой, это не новая утечка
    expect(notBid.body.budget).not.toBeUndefined();

    await grantLeadCredits(app, plumber.userId, 1);
    await request(app.getHttpServer())
      .post(`/api/v1/planned-orders/${order.id}/bids`)
      .set('Authorization', `Bearer ${plumber.token}`)
      .send({ price: 8000, term: 'сегодня' })
      .expect(201);

    const bidder = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${plumber.token}`)
      .expect(200);
    // Мастер, откликнувшийся ставкой, но ещё не выбранный клиентом — доступ не расширен: адрес и детали по-прежнему скрыты.
    expect(bidder.body.address).toBeNull();
    expect(bidder.body.entrance).toBeNull();
    expect(bidder.body.floor).toBeNull();
    expect(bidder.body.apartment).toBeNull();
    expect(bidder.body.addressComment).toBeNull();
    expect(bidder.body.photos).toEqual([]);
  });

  it('выбранный мастер видит адрес, детали и фото; чужой мастер — по-прежнему нет', async () => {
    const order = await createPlannedOrderViaApi(app, client.token, plumbingId, {
      photoPaths: ['planned/photo-1.jpg'],
    } as any);
    const anotherPlumber = await createActiveMaster(app, '+77070000004', plumbingId);

    await prisma.plannedOrder.update({
      where: { id: order.id },
      data: { masterId: plumber.userId, entrance: '2', floor: '5', apartment: '42', addressComment: 'домофон не работает' },
    });

    const revealed = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${plumber.token}`)
      .expect(200);
    expect(revealed.body.address).toBe('ул. Абая, 1');
    expect(revealed.body.entrance).toBe('2');
    expect(revealed.body.floor).toBe('5');
    expect(revealed.body.apartment).toBe('42');
    expect(revealed.body.addressComment).toBe('домофон не работает');
    expect(revealed.body.photos).toHaveLength(1);
    expect(revealed.body.client).toMatchObject({
      id: client.userId,
      phone: '+77070000001',
    });

    const stillRedacted = await request(app.getHttpServer())
      .get(`/api/v1/planned-orders/${order.id}`)
      .set('Authorization', `Bearer ${anotherPlumber.token}`)
      .expect(200);
    expect(stillRedacted.body.address).toBeNull();
    expect(stillRedacted.body.entrance).toBeNull();
    expect(stillRedacted.body.floor).toBeNull();
    expect(stillRedacted.body.apartment).toBeNull();
    expect(stillRedacted.body.addressComment).toBeNull();
    expect(stillRedacted.body.photos).toEqual([]);
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
