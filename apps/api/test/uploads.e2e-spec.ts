import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';

describe('POST /uploads (e2e)', () => {
  let app: INestApplication;
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    client = await loginAs(app, '+77050000001');
  });

  it('загружает JPEG и возвращает path', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xdb]), { filename: 'photo.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(res.body.path).toMatch(/\.jpg$/);
  });

  it('без файла — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(400);
  });

  it('недопустимый MIME — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', `Bearer ${client.token}`)
      .attach('file', Buffer.from('not an image'), { filename: 'file.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('без токена — 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .attach('file', Buffer.from([0xff, 0xd8]), { filename: 'photo.jpg', contentType: 'image/jpeg' })
      .expect(401);
  });
});
