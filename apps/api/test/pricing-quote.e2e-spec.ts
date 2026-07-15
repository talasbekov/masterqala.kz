import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  resetDb,
  seedCategories,
  createActiveMaster,
  setMasterOffline,
  ALMATY,
  pointAtKm,
} from './helpers';
import {
  PricingService,
  calcPrices,
  computeTimeCoefficient,
} from '../src/pricing/pricing.service';

describe('PricingService.quote (e2e)', () => {
  let app: INestApplication;
  let pricing: PricingService;
  let plumbingId: string;

  beforeAll(async () => {
    app = await createTestApp();
    pricing = app.get(PricingService);
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
    const q = await pricing.quote(plumbingId, ALMATY);
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
    expect(await pricing.quote(plumbingId, ALMATY)).toBeNull();
    const near = await createActiveMaster(
      app,
      '+77020000004',
      plumbingId,
      pointAtKm(1),
    );
    await setMasterOffline(app, near.userId);
    expect(await pricing.quote(plumbingId, ALMATY)).toBeNull();
    void far;
  });
});
