import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs, seedCategories } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import { AdminService } from '../src/admin/admin.service';
import { MastersService } from '../src/masters/masters.service';
import { AuditLogService } from '../src/audit-log/audit-log.service';
import { Prisma } from '@prisma/client';

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

  it('waits for an in-flight document upload and rejects approval of its quarantined document', async () => {
    const { profileId } = await setup();
    const profile = await prisma.masterProfile.findUniqueOrThrow({ where: { id: profileId } });
    const operator = await prisma.user.findFirstOrThrow({ where: { role: 'OPERATOR' } });
    let uploadInserted!: () => void;
    let releaseUpload!: () => void;
    let decisionStarted!: () => void;
    const inserted = new Promise<void>((resolve) => { uploadInserted = resolve; });
    const release = new Promise<void>((resolve) => { releaseUpload = resolve; });
    const deciding = new Promise<void>((resolve) => { decisionStarted = resolve; });
    const storage = { save: jest.fn().mockResolvedValue('verification-race-fixture.jpg'), remove: jest.fn() };
    const uploadPrisma = {
      masterProfile: prisma.masterProfile,
      masterDocument: prisma.masterDocument,
      $executeRaw: prisma.$executeRaw.bind(prisma),
      $queryRaw: prisma.$queryRaw.bind(prisma),
      $transaction: (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => prisma.$transaction(async (tx) => {
        const result = await work(tx);
        uploadInserted();
        await release;
        return result;
      }),
    };
    const decisionPrisma = {
      masterProfile: prisma.masterProfile,
      $queryRaw: prisma.$queryRaw.bind(prisma),
      $transaction: (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        decisionStarted();
        return prisma.$transaction(work);
      },
    };
    const masters = new MastersService(uploadPrisma as never, { get: () => 'BYPASS' } as never,
      { enqueueMasterDocument: async () => undefined } as never, {} as never, storage as never);
    const admin = new AdminService(decisionPrisma as never, storage as never, app.get(AuditLogService));
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const upload = masters.uploadDocument(profile.userId, 'ID_CARD', {
      fieldname: 'file', originalname: 'fixture.jpg', mimetype: 'image/jpeg', buffer, size: buffer.length,
    } as Express.Multer.File);
    // The upload holds the actual profile row lock until the decision is attempting its transaction.
    await inserted;
    const decision = admin.decide(operator.id, profileId, { decision: 'APPROVE' });
    const rejected = expect(decision).rejects.toMatchObject({ status: 409 });
    await deciding;
    releaseUpload();
    await upload;
    await rejected;
    expect((await prisma.masterProfile.findUniqueOrThrow({ where: { id: profileId } })).status).toBe('PENDING_REVIEW');
    expect(await prisma.verificationDecision.count({ where: { masterProfileId: profileId } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { targetId: profileId, action: 'MASTER_APPROVED' } })).toBe(0);
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
    expect(await prisma.auditLog.count({ where: { targetId: profileId, action: 'MASTER_APPROVED' } })).toBe(1);
  });
});
