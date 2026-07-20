import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  resetDb,
  seedCategories,
  loginAs,
  createActiveMaster,
  createOrderViaApi,
} from './helpers';

describe('Admin orders — list & detail (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categories: Awaited<ReturnType<typeof seedCategories>>;
  let operator: { token: string; userId: string };
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDb(app);
    categories = await seedCategories(app);
    operator = await loginAs(app, '+77010000001', 'OPERATOR');
    client = await loginAs(app, '+77010000002');
    await createActiveMaster(app, '+77010000003', categories.plumbing.id);
  });

  it('lists urgent orders and marks a stuck wave-3 search as assignable in the detail view', async () => {
    const created = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: created.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id, type: 'urgent', status: 'SEARCHING' })]),
    );

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${created.id}?type=urgent`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(detail.body.canAssign).toBe(true);
    expect(detail.body.timeline[0]).toMatchObject({ event: expect.stringContaining('создана') });
  });

  it('rejects non-operator callers', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);
  });
});
