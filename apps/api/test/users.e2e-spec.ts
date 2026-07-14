import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';

describe('Users: me', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  it('без токена → 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('GET возвращает профиль, PATCH обновляет имя и адрес', async () => {
    const { token } = await loginAs(app, '+77071234567');
    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.phone).toBe('+77071234567');
    expect(me.body.name).toBeNull();

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ерда', defaultAddress: 'Алматы, ул. Абая 1' })
      .expect(200);
    expect(updated.body.name).toBe('Ерда');
    expect(updated.body.defaultAddress).toBe('Алматы, ул. Абая 1');
  });

  it('PATCH с name длиннее 100 символов → 400', async () => {
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'x'.repeat(101) })
      .expect(400);
  });

  it('PATCH с посторонним полем role не меняет роль (whitelist)', async () => {
    const { token } = await loginAs(app, '+77071234567');
    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ерда', role: 'OPERATOR' })
      .expect(200);
    expect(res.body.role).toBe('CLIENT');
  });
});
