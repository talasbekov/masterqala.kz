import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';

describe('CRUD сохранённых адресов (e2e)', () => {
  let app: INestApplication;
  let client: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    client = await loginAs(app, '+77053000001');
  });

  it('создаёт, читает, обновляет, удаляет свой адрес', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ label: 'Дом', address: 'ул. Абая, 1', isDefault: true })
      .expect(201);
    expect(created.body).toMatchObject({ label: 'Дом', address: 'ул. Абая, 1', isDefault: true });

    const list = await request(app.getHttpServer())
      .get('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/addresses/${created.body.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .send({ label: 'Дом (новый)' })
      .expect(200);
    expect(updated.body.label).toBe('Дом (новый)');

    await request(app.getHttpServer())
      .delete(`/api/v1/addresses/${created.body.id}`)
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);

    const empty = await request(app.getHttpServer())
      .get('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    expect(empty.body).toHaveLength(0);
  });

  it('второй isDefault:true снимает флаг с первого', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ label: 'Дом', address: 'ул. Абая, 1', isDefault: true })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ label: 'Работа', address: 'ул. Кенесары, 2', isDefault: true })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(200);
    const byId = Object.fromEntries(list.body.map((a: { id: string; isDefault: boolean }) => [a.id, a.isDefault]));
    expect(byId[first.body.id]).toBe(false);
    expect(byId[second.body.id]).toBe(true);
  });

  it('чужой адрес не редактировать/не удалить (403)', async () => {
    const mine = await request(app.getHttpServer())
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${client.token}`)
      .send({ label: 'Дом', address: 'ул. Абая, 1' })
      .expect(201);
    const stranger = await loginAs(app, '+77053000002');
    await request(app.getHttpServer())
      .patch(`/api/v1/addresses/${mine.body.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ label: 'Взлом' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/addresses/${mine.body.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(403);
  });
});
