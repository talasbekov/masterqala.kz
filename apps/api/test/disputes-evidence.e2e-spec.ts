import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { MatchingService } from '../src/orders/matching.service';

describe('Доказательства и пояснение по спору (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let matching: MatchingService;
  let plumbingId: string;
  let client: { token: string; userId: string };
  let master: { token: string; userId: string };
  let orderId: string;
  let disputeId: string;

  const post = (token: string, oid: string, path: string) =>
    request(app.getHttpServer()).post(`/api/v1/orders/${oid}/${path}`).set('Authorization', `Bearer ${token}`).send({});

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    matching = app.get(MatchingService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77130000001');
    master = await createActiveMaster(app, '+77130000002', plumbingId);

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

    const disputeRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/disputes`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ reason: 'Потоп' })
      .expect(201);
    disputeId = disputeRes.body.id;
  });

  it('открывший спор загружает фото-доказательство', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/disputes/${disputeId}/evidence`)
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'proof.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(res.body.evidenceDocIds).toHaveLength(1);
  });

  it('загрузка не-изображения отклоняется (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/disputes/${disputeId}/evidence`)
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from('not an image'), { filename: 'proof.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('вторая сторона добавляет пояснение', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${master.token}`)
      .send({ counterStatement: 'Работа выполнена качественно, потоп не связан' })
      .expect(200);
    expect(res.body.counterStatement).toBe('Работа выполнена качественно, потоп не связан');
  });

  it('открывший спор не может добавить пояснение как вторая сторона (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ counterStatement: 'Сам себе возражаю' })
      .expect(403);
  });

  it('посторонний не может загрузить доказательство (403)', async () => {
    const stranger = await loginAs(app, '+77130000099');
    await request(app.getHttpServer())
      .post(`/api/v1/disputes/${disputeId}/evidence`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'proof.jpg', contentType: 'image/jpeg' })
      .expect(403);
  });
});
