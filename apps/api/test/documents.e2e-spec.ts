import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs, seedCategories } from './helpers';

describe('Masters: documents', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createTestApp(); });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  async function createApplication(token: string, categoryId: string) {
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Иванов Иван Иванович',
        iin: '900101300123',
        district: 'Бостандыкский',
        experienceYears: 5,
        categoryIds: [categoryId],
      })
      .expect(201);
  }

  it('загрузка png-документа к заявке → 201', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    await createApplication(token, plumbing.id);

    const res = await request(app.getHttpServer())
      .post('/api/v1/masters/application/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'ID_CARD')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: 'udo.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.type).toBe('ID_CARD');
    expect(res.body.originalName).toBe('udo.png');
  });

  it('недопустимый mime-тип → 400', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    await createApplication(token, plumbing.id);

    await request(app.getHttpServer())
      .post('/api/v1/masters/application/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'ID_CARD')
      .attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' })
      .expect(400);
  });

  it('без заявки → 404', async () => {
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .post('/api/v1/masters/application/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'ID_CARD')
      .attach('file', Buffer.from([0x89]), { filename: 'x.png', contentType: 'image/png' })
      .expect(404);
  });
});
