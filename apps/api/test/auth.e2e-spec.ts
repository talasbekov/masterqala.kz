import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth: request-code', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => { await resetDb(app); });
  afterAll(async () => { await app.close(); });

  it('создаёт код с TTL 5 минут и отвечает 204', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-code')
      .send({ phone: '87071234567' })
      .expect(204);

    const code = await prisma.smsCode.findFirstOrThrow({ where: { phone: '+77071234567' } });
    expect(code.code).toMatch(/^\d{6}$/);
    const ttlMs = code.expiresAt.getTime() - code.createdAt.getTime();
    expect(ttlMs).toBeGreaterThan(4.9 * 60_000);
    expect(ttlMs).toBeLessThan(5.1 * 60_000);
  });

  it('невалидный номер → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-code')
      .send({ phone: '12345' })
      .expect(400);
  });

  it('4-й запрос за 10 минут → 429', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/request-code')
        .send({ phone: '+77071234567' })
        .expect(204);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/request-code')
      .send({ phone: '+77071234567' })
      .expect(429);
  });

  it('параллельные запросы не превышают лимит 3 кодов', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/auth/request-code')
          .send({ phone: '+77071234567' }),
      ),
    );
    const ok = results.filter((r) => r.status === 204).length;
    const limited = results.filter((r) => r.status === 429).length;
    expect(ok).toBe(3);
    expect(limited).toBe(3);
    expect(await prisma.smsCode.count({ where: { phone: '+77071234567' } })).toBe(3);
  });
});
