import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs, seedCategories } from './helpers';

describe('Admin: applications', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  async function submitApplication(phone: string) {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, phone);
    const res = await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Иванов Иван Иванович',
        iin: '900101300123',
        district: 'Бостандыкский',
        experienceYears: 5,
        categoryIds: [plumbing.id],
      })
      .expect(201);
    return { masterToken: token, profileId: res.body.id as string };
  }

  it('клиенту доступ запрещён → 403', async () => {
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .get('/api/v1/admin/applications')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('оператор видит список с фильтром по статусу и детали', async () => {
    const { profileId } = await submitApplication('+77071234567');
    const { token: opToken } = await loginAs(app, '+77000000001', 'OPERATOR');

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/applications?status=PENDING_REVIEW')
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].user.phone).toBe('+77071234567');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/applications/${profileId}`)
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);
    expect(detail.body.iin).toBe('900101300123');
    expect(detail.body.decisions).toEqual([]);
  });

  it('оператор скачивает документ мастера', async () => {
    const { masterToken, profileId } = await submitApplication('+77071234567');
    const upload = await request(app.getHttpServer())
      .post('/api/v1/masters/application/documents')
      .set('Authorization', `Bearer ${masterToken}`)
      .field('type', 'ID_CARD')
      .attach('file', Buffer.from([0x89, 0x50]), { filename: 'udo.png', contentType: 'image/png' })
      .expect(201);

    const { token: opToken } = await loginAs(app, '+77000000001', 'OPERATOR');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/applications/${profileId}/documents/${upload.body.id}`)
      .set('Authorization', `Bearer ${opToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  it('невалидный status → 400', async () => {
    const { token: opToken } = await loginAs(app, '+77000000001', 'OPERATOR');
    await request(app.getHttpServer())
      .get('/api/v1/admin/applications?status=BOGUS')
      .set('Authorization', `Bearer ${opToken}`)
      .expect(400);
  });
});
