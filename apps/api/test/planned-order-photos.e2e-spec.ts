import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createPlannedOrderViaApi } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Фото к плановой заявке (e2e)', () => {
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
    client = await loginAs(app, '+77052000001');
  });

  it('создание с photoPaths сохраняет PlannedOrderPhoto', async () => {
    const up = await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'a.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const order = await createPlannedOrderViaApi(app, client.token, plumbingId, { photoPaths: [up.body.path] });

    expect(order.photos).toHaveLength(1);
    const count = await prisma.plannedOrderPhoto.count({ where: { plannedOrderId: order.id } });
    expect(count).toBe(1);
  });
});
