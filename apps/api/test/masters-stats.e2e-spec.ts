import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, createActiveMaster, seedCategories } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GET /masters/me/stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(async () => { await resetDb(app); });

  it('без авторизации — 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/masters/me/stats').expect(401);
  });

  it('свежий мастер без заказов — все нули, рейтинг null', async () => {
    const { plumbing } = await seedCategories(app);
    const master = await createActiveMaster(app, '+77012220001', plumbing.id);

    const res = await request(app.getHttpServer())
      .get('/api/v1/masters/me/stats')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);

    expect(res.body).toEqual({ completedCount: 0, earnings: 0, rating: null, reviewCount: 0 });
  });

  it('суммирует закрытые срочные и плановые заявки + начисления', async () => {
    const { plumbing } = await seedCategories(app);
    const master = await createActiveMaster(app, '+77012220002', plumbing.id);
    const client = await prisma.user.create({ data: { phone: '+77012220099', role: 'CLIENT' } });

    const order = await prisma.order.create({
      data: {
        clientId: client.id,
        masterId: master.userId,
        categoryId: plumbing.id,
        status: 'CLOSED',
        description: 'x',
        address: 'x',
        district: 'x',
        calloutPrice: 3000,
        serviceFee: 1000,
        commercialMode: 'PAID_MOCK',
      },
    });
    await prisma.accrual.create({
      data: { masterUserId: master.userId, orderId: order.id, type: 'CALLOUT_COMPENSATION', amount: 2000 },
    });
    await prisma.plannedOrder.create({
      data: {
        clientId: client.id,
        masterId: master.userId,
        categoryId: plumbing.id,
        status: 'CLOSED',
        description: 'x',
        address: 'x',
        district: 'x',
        slotStart: new Date(),
        slotEnd: new Date(Date.now() + 3600000),
        commercialMode: 'PAID_MOCK',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/masters/me/stats')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);

    expect(res.body).toEqual({ completedCount: 2, earnings: 2000, rating: null, reviewCount: 0 });
  });
});
