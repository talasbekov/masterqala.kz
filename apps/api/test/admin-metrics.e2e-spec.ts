import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster, createOrderViaApi } from './helpers';

describe('Admin metrics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('reports dashboard aggregates including stuck searches', async () => {
    const categories = await seedCategories(app);
    const operator = await loginAs(app, '+77010000001', 'OPERATOR');
    const client = await loginAs(app, '+77010000002');
    await createActiveMaster(app, '+77010000003', categories.plumbing.id);

    const stuck = await createOrderViaApi(app, client.token, categories.plumbing.id);
    await prisma.order.update({
      where: { id: stuck.id },
      data: { wave: 3, createdAt: new Date(Date.now() - 10 * 60_000) },
    });

    const pendingApplicant = await loginAs(app, '+77010000004');
    await prisma.masterProfile.create({
      data: {
        userId: pendingApplicant.userId,
        fullName: 'В ожидании',
        iin: '000000000000',
        district: 'Есильский район',
        experienceYears: 1,
        status: 'PENDING_REVIEW',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/metrics')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(res.body.activeUrgentCount).toBeGreaterThanOrEqual(1);
    expect(res.body.pendingVerificationCount).toBe(1);
    expect(res.body.stuckSearches).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: stuck.id, wave: 3 })]),
    );
  });
});
