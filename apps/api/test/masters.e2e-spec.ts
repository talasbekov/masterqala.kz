import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs, seedCategories } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Masters: application', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  function validBody(categoryId: string) {
    return {
      fullName: 'Иванов Иван Иванович',
      iin: '900101300123',
      district: 'Бостандыкский',
      experienceYears: 5,
      categoryIds: [categoryId],
    };
  }

  it('подача анкеты создаёт профиль в статусе PENDING_REVIEW', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    const res = await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(plumbing.id))
      .expect(201);
    expect(res.body.status).toBe('PENDING_REVIEW');
    expect(res.body.categories).toHaveLength(1);
  });

  it('невалидный ИИН → 400', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(plumbing.id), iin: '12345' })
      .expect(400);
  });

  it('повторная подача при PENDING_REVIEW → 409', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(plumbing.id))
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(plumbing.id))
      .expect(409);
  });

  it('переподача после NEEDS_INFO возвращает статус в PENDING_REVIEW', async () => {
    const { plumbing, electrics } = await seedCategories(app);
    const { token, userId } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(plumbing.id))
      .expect(201);
    await prisma.masterProfile.update({ where: { userId }, data: { status: 'NEEDS_INFO' } });

    const res = await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(electrics.id), experienceYears: 6 })
      .expect(201);
    expect(res.body.status).toBe('PENDING_REVIEW');
    expect(res.body.experienceYears).toBe(6);
    expect(res.body.categories[0].category.slug).toBe('electrics');
  });

  it('GET своей заявки: 404 без заявки, 200 с заявкой', async () => {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
    await request(app.getHttpServer())
      .get('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody(plumbing.id))
      .expect(201);
    const res = await request(app.getHttpServer())
      .get('/api/v1/masters/application')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.status).toBe('PENDING_REVIEW');
  });

  it('GET /categories публичный', async () => {
    await seedCategories(app);
    const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
    expect(res.body).toHaveLength(2);
  });
});
