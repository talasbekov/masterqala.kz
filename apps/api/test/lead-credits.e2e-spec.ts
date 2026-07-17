import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, resetDb, loginAs } from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Lead-кредиты (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let master: { token: string; userId: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    master = await loginAs(app, '+77050000001');
  });

  it('баланс изначально 0, список пакетов доступен', async () => {
    const balance = await request(app.getHttpServer())
      .get('/api/v1/lead-credits/balance')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(balance.body).toEqual({ balance: 0 });

    const packages = await request(app.getHttpServer())
      .get('/api/v1/lead-credits/packages')
      .set('Authorization', `Bearer ${master.token}`)
      .expect(200);
    expect(packages.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'start', credits: 10, priceTenge: 5000 })]),
    );
  });

  it('покупка пакета начисляет кредиты и пишет транзакцию PURCHASE', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'start' })
      .expect(201);
    expect(res.body.balance).toBe(10);

    const purchase = await prisma.leadCreditPurchase.findFirstOrThrow({ where: { masterUserId: master.userId } });
    expect(purchase).toMatchObject({ credits: 10, priceTenge: 5000, status: 'SUCCEEDED' });
    const tx = await prisma.leadCreditTransaction.findFirstOrThrow({ where: { masterUserId: master.userId } });
    expect(tx).toMatchObject({ type: 'PURCHASE', amount: 10 });

    const second = await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'single' })
      .expect(201);
    expect(second.body.balance).toBe(11);
  });

  it('неизвестный пакет — 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/lead-credits/purchase')
      .set('Authorization', `Bearer ${master.token}`)
      .send({ package: 'unknown' })
      .expect(400);
  });
});
