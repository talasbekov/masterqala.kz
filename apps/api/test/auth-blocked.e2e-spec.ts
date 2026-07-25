import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Blocked user enforcement (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());
  beforeEach(() => resetDb(app));

  it('rejects an already-issued token once the user is blocked', async () => {
    const client = await loginAs(app, '+77011112233');
    await prisma.user.update({
      where: { id: client.userId },
      data: { isBlocked: true, blockedAt: new Date(), blockedReason: 'жалобы' },
    });

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${client.token}`)
      .expect(403);
  });

  it('refuses to issue a new token for a blocked user', async () => {
    const client = await loginAs(app, '+77011112233');
    await prisma.user.update({ where: { id: client.userId }, data: { isBlocked: true } });

    await request(app.getHttpServer())
      .post('/api/v1/auth/request-code')
      .send({ phone: '+77011112233' })
      .expect(204);
    const code = await prisma.smsCode.findFirstOrThrow({
      where: { phone: '+77011112233' },
      orderBy: { createdAt: 'desc' },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-code')
      .send({ phone: '+77011112233', code: code.code })
      .expect(403);
  });
});
