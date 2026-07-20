import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';

describe('Admin users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('lists users and toggles block state', async () => {
    const client = await loginAs(app, '+77011234567');
    const operator = await loginAs(app, '+77019999999', 'OPERATOR');

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);
    expect(list.body.find((u: any) => u.id === client.userId)).toMatchObject({ isBlocked: false });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${client.userId}/block`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ reason: 'жалобы' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${client.userId}/unblock`)
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
  });

  it('rejects non-operator callers', async () => {
    const client = await loginAs(app, '+77011234567');
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);
  });

  it('requires a reason to block', async () => {
    const client = await loginAs(app, '+77011234567');
    const operator = await loginAs(app, '+77019999999', 'OPERATOR');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${client.userId}/block`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({})
      .expect(400);
  });
});
