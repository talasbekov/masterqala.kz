import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Commercial mode (e2e)', () => {
  let app: INestApplication;
  const previousMode = process.env.COMMERCIAL_MODE;

  beforeAll(async () => {
    process.env.COMMERCIAL_MODE = 'FREE_PILOT';
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousMode === undefined) delete process.env.COMMERCIAL_MODE;
    else process.env.COMMERCIAL_MODE = previousMode;
  });

  it('GET /api/v1/config/public сообщает об отключённой коммерции', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/config/public')
      .expect(200)
      .expect({
        commercialMode: 'FREE_PILOT',
        paymentsEnabled: false,
        leadCreditsEnabled: false,
        payoutsEnabled: false,
      });
  });
});
