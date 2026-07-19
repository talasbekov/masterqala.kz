import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, pointAtKm, ALMATY } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Фото к срочной заявке (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let plumbingId: string;
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
    client = await loginAs(app, '+77051000001');
    await createActiveMaster(app, '+77051000002', plumbingId, pointAtKm(2));
  });

  it('создание с photoPaths сохраняет OrderPhoto и отдаёт их в ответе', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const order = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'Прорвало трубу',
        address: 'ул. Абая, 1',
        district: 'Есильский район',
        photoPaths: [up.body.path],
        ...ALMATY,
      })
      .expect(201);

    expect(order.body.photos).toHaveLength(1);
    expect(order.body.photos[0].path).toBe(up.body.path);

    const count = await prisma.orderPhoto.count({ where: { orderId: order.body.id } });
    expect(count).toBe(1);
  });

  it('больше 5 фото — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .send({
        categoryId: plumbingId,
        description: 'т',
        address: 'а',
        district: 'р',
        photoPaths: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg'],
        ...ALMATY,
      })
      .expect(400);
  });

  describe('GET /orders/:id/photos/:photoId', () => {
    async function createOrderWithPhoto() {
      const up = await request(app.getHttpServer())
        .post('/api/v1/uploads')
        .set('Authorization', `Bearer ${client.token}`)
        .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(201);

      const order = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${client.token}`)
        .send({
          categoryId: plumbingId,
          description: 'Прорвало трубу',
          address: 'ул. Абая, 1',
          district: 'Есильский район',
          photoPaths: [up.body.path],
          ...ALMATY,
        })
        .expect(201);

      return { orderId: order.body.id as string, photoId: order.body.photos[0].id as string };
    }

    it('клиент заявки получает своё фото — 200 image/jpeg', async () => {
      const { orderId, photoId } = await createOrderWithPhoto();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}/photos/${photoId}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      expect(res.headers['content-type']).toBe('image/jpeg');
    });

    it('посторонний пользователь (не клиент, не мастер заявки, не OPERATOR) — 403', async () => {
      const { orderId, photoId } = await createOrderWithPhoto();
      const stranger = await loginAs(app, '+77051000099');

      await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}/photos/${photoId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(403);
    });

    it('несуществующий photoId на реальной заявке — 404', async () => {
      const { orderId } = await createOrderWithPhoto();

      await request(app.getHttpServer())
        .get(`/api/v1/orders/${orderId}/photos/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(404);
    });
  });
});
