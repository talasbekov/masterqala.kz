import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs, seedCategories } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin: decision', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  async function setup() {
    const { plumbing } = await seedCategories(app);
    const { token } = await loginAs(app, '+77071234567');
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
    const { token: opToken } = await loginAs(app, '+77000000001', 'OPERATOR');
    return { profileId: res.body.id as string, opToken };
  }

  it('APPROVE → ACTIVE + запись в журнале', async () => {
    const { profileId, opToken } = await setup();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profileId}/decision`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ decision: 'APPROVE' })
      .expect(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(await prisma.verificationDecision.count({ where: { masterProfileId: profileId } })).toBe(1);
  });

  it('REJECT без комментария → 400; с комментарием → REJECTED с причиной', async () => {
    const { profileId, opToken } = await setup();
    await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profileId}/decision`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ decision: 'REJECT' })
      .expect(400);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profileId}/decision`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ decision: 'REJECT', comment: 'Документы нечитаемы' })
      .expect(201);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.rejectionReason).toBe('Документы нечитаемы');
  });

  it('REQUEST_INFO → NEEDS_INFO; повторное решение по той же заявке → 409', async () => {
    const { profileId, opToken } = await setup();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profileId}/decision`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ decision: 'REQUEST_INFO', comment: 'Приложите подтверждение квалификации' })
      .expect(201);
    expect(res.body.status).toBe('NEEDS_INFO');
    await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profileId}/decision`)
      .set('Authorization', `Bearer ${opToken}`)
      .send({ decision: 'APPROVE' })
      .expect(409);
  });

  it('параллельные решения: только одно проходит, журнал не дублируется', async () => {
    const { profileId, opToken } = await setup();
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(app.getHttpServer())
          .post(`/api/v1/admin/applications/${profileId}/decision`)
          .set('Authorization', `Bearer ${opToken}`)
          .send({ decision: 'APPROVE' }),
      ),
    );
    const ok = results.filter((r) => r.status === 201).length;
    const conflict = results.filter((r) => r.status === 409).length;
    expect(ok).toBe(1);
    expect(conflict).toBe(3);
    expect(await prisma.verificationDecision.count({ where: { masterProfileId: profileId } })).toBe(1);
  });
});
