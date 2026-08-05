import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, resetDb, loginAs } from './helpers';

describe('Admin journal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('records a verification decision and surfaces it in the journal', async () => {
    const operator = await loginAs(app, '+77010000001', 'OPERATOR');
    const applicant = await loginAs(app, '+77010000005');
    await prisma.masterProfile.create({
      data: {
        userId: applicant.userId,
        fullName: 'Тест Тестов',
        iin: '000000000001',
        district: 'Есильский район',
        experienceYears: 1,
        status: 'PENDING_REVIEW',
      },
    });
    const profile = await prisma.masterProfile.findFirstOrThrow({ where: { userId: applicant.userId } });

    await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${profile.id}/decision`)
      .set('Authorization', `Bearer ${operator.token}`)
      .send({ decision: 'APPROVE' })
      .expect(201);

    const journal = await request(app.getHttpServer())
      .get('/api/v1/admin/journal')
      .set('Authorization', `Bearer ${operator.token}`)
      .expect(200);

    expect(journal.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'MASTER_APPROVED', targetId: profile.id, actorType: 'OPERATOR' }),
      ]),
    );
  });
});
