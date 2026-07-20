import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, seedCategories, loginAs, createActiveMaster } from './helpers';

describe('Admin masters (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('lists active masters with a derived status', async () => {
    const categories = await seedCategories(app);
    const operator = await loginAs(app, '+77019999999', 'OPERATOR');
    const master = await createActiveMaster(app, '+77010000001', categories.plumbing.id);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/masters')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'активен · онлайн', categories: ['Сантехника'] }),
    ]));
    expect(res.body.find((r: any) => r.id)).toBeDefined();
    expect(master.userId).toBeTruthy();
  });

  it('filters masters by category slug', async () => {
    const categories = await seedCategories(app);
    const operator = await loginAs(app, '+77019999999', 'OPERATOR');
    await createActiveMaster(app, '+77010000001', categories.plumbing.id);
    await createActiveMaster(app, '+77010000002', categories.electrics.id);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/masters?category=plumbing')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual(expect.objectContaining({ categories: ['Сантехника'] }));
  });
});
