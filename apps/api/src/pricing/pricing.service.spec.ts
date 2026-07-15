import { computeTimeCoefficient, calcPrices } from './pricing.service';

// Час Алматы (UTC+5) задаём через UTC: 12:00 Алматы = 07:00 UTC.
function almatyHour(hour: number): Date {
  return new Date(Date.UTC(2026, 6, 15, (hour - 5 + 24) % 24, 30));
}

describe('computeTimeCoefficient (Asia/Almaty)', () => {
  it.each([
    [8, 1.0],
    [12, 1.0],
    [19, 1.0],
    [20, 1.2],
    [22, 1.2],
    [23, 1.5],
    [2, 1.5],
    [7, 1.5],
  ])('час %i → коэф. %f', (hour, coef) => {
    expect(computeTimeCoefficient(almatyHour(hour))).toBe(coef);
  });
});

describe('calcPrices', () => {
  const cfg = { baseFare: 2000, perKm: 150, feeRate: 0.4, feeMin: 1000 };

  it('день, 4 км: (2000 + 4×150)×1.0 = 2600; сбор 40% = 1040', () => {
    expect(calcPrices(cfg, 4, 1.0)).toEqual({
      calloutPrice: 2600,
      serviceFee: 1040,
    });
  });

  it('ночь, 2 км: (2000+300)×1.5 = 3450; сбор 1380', () => {
    expect(calcPrices(cfg, 2, 1.5)).toEqual({
      calloutPrice: 3450,
      serviceFee: 1380,
    });
  });

  it('минимальный сбор 1000 ₸: 0.5 км днём → выезд 2075, 40% = 830 → сбор 1000', () => {
    expect(calcPrices(cfg, 0.5, 1.0)).toEqual({
      calloutPrice: 2075,
      serviceFee: 1000,
    });
  });
});
