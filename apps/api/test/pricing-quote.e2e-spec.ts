import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  createTestApp,
  resetDb,
  seedCategories,
  createActiveMaster,
  setMasterOffline,
  ALMATY,
  pointAtKm,
} from './helpers';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  PricingService,
  calcPrices,
  computeTimeCoefficient,
} from '../src/pricing/pricing.service';

const NO_CLIENT = '00000000-0000-0000-0000-000000000000';

describe('PricingService.quote (e2e)', () => {
  let app: INestApplication;
  let pricing: PricingService;
  let prisma: PrismaService;
  let plumbingId: string;

  beforeAll(async () => {
    app = await createTestApp();
    pricing = app.get(PricingService);
    prisma = app.get(PrismaService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(app);
    const { plumbing } = await seedCategories(app);
    plumbingId = plumbing.id;
  });

  it('считает цену от ближайшего онлайн-мастера (прямая × 1.3)', async () => {
    await createActiveMaster(app, '+77020000001', plumbingId, pointAtKm(2));
    await createActiveMaster(app, '+77020000002', plumbingId, pointAtKm(5));
    const q = await pricing.quote(plumbingId, ALMATY, NO_CLIENT);
    expect(q).not.toBeNull();
    expect(q!.distanceKm).toBeGreaterThan(2.4); // ~2 км × 1.3
    expect(q!.distanceKm).toBeLessThan(2.8);
    const expected = calcPrices(
      { baseFare: 2000, perKm: 150, feeRate: 0.4, feeMin: 1000 },
      q!.distanceKm,
      computeTimeCoefficient(new Date()),
    );
    expect(q!.calloutPrice).toBe(expected.calloutPrice);
    expect(q!.serviceFee).toBe(expected.serviceFee);
  });

  it('null, если мастера офлайн или дальше 10 км', async () => {
    const far = await createActiveMaster(
      app,
      '+77020000003',
      plumbingId,
      pointAtKm(12),
    );
    expect(await pricing.quote(plumbingId, ALMATY, NO_CLIENT)).toBeNull();
    const near = await createActiveMaster(
      app,
      '+77020000004',
      plumbingId,
      pointAtKm(1),
    );
    await setMasterOffline(app, near.userId);
    expect(await pricing.quote(plumbingId, ALMATY, NO_CLIENT)).toBeNull();
    void far;
  });

  it('мастер не находит себя как ближайшего свободного мастера в превью для себя', async () => {
    const selfMaster = await createActiveMaster(app, '+77130000001', plumbingId);
    const empty = await request(app.getHttpServer())
      .post('/api/v1/orders/preview')
      .set('Authorization', `Bearer ${selfMaster.token}`)
      .send({ categoryId: plumbingId, ...ALMATY })
      .expect(201);
    expect(empty.body).toEqual({ available: false });
  });

  it('заблокированный мастер не учитывается в превью цены', async () => {
    const master = await createActiveMaster(app, '+77130000002', plumbingId, pointAtKm(2));
    await prisma.masterProfile.updateMany({
      where: { userId: master.userId },
      data: { blockedUntil: new Date(Date.now() + 24 * 3600 * 1000) },
    });
    const quote = await pricing.quote(plumbingId, ALMATY, NO_CLIENT);
    expect(quote).toBeNull(); // единственный мастер в фикстуре заблокирован
  });
});
