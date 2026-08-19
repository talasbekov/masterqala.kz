import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';
import { MatchingService } from '../src/orders/matching.service';

describe('Список своих споров (e2e)', () => {
  let app: INestApplication;
  let matching: MatchingService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let orderId: string;

  const post = (token: string, oid: string, path: string) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${oid}/${path}`).set('Authorization', `Bearer ${token}`).send({});

  beforeAll(async () => {
    app = await createTestApp();
    matching = app.get(MatchingService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77140000001');
    master = await createActiveMaster(app, '+77140000002', plumbingId);

    const order = await createOrderViaApi(app, client.token, plumbingId);
    orderId = order.id;
    await matching.handleWave({ orderId, wave: 1 });
    await post(master.token, orderId, 'accept').expect(201);
    await post(master.token, orderId, 'on-way').expect(201);
    await post(master.token, orderId, 'on-site').expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/propose-price`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ amount: 10000 })
      .expect(201);
    await post(client.token, orderId, 'confirm-price').expect(201);
    await post(master.token, orderId, 'complete').expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Потоп' })
      .expect(201);
  });

  it('мастер видит спор по своей заявке в списке', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/disputes/mine')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ orderId, status: 'OPEN', reason: 'Потоп' });
  });

  it('клиент тоже видит свой спор в списке', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/disputes/mine')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ orderId });
  });

  it('посторонний мастер не видит чужой спор', async () => {
    const stranger = await createActiveMaster(app, '+77140000003', plumbingId);
    const res = await request(app.getHttpServer())
      .get('/api/v1/disputes/mine')
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(200);
    expect(res.body).toHaveLength(0);
  });
});
