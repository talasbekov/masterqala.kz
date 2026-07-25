import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb } from './helpers';

describe('Health observability (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('отдаёт независимый liveness', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200);

    expect(response.body.status).toBe('alive');
    expect(response.body.checkedAt).toEqual(expect.any(String));
  });

  it('отдаёт сокращённый readiness без внутренних ошибок и backlog', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ready',
      ready: true,
      dependencies: {
        database: { status: 'UP' },
        queue: { status: 'DISABLED', enabled: false },
        scanner: { status: 'DISABLED', mode: 'DISABLED' },
      },
    });
    expect(response.body.environment).toBeUndefined();
    expect(response.body.backlog).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('lastError');
  });
});
