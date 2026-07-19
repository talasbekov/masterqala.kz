import { estimateEtaMinutes, ASSUMED_SPEED_KMH } from './eta';

describe('estimateEtaMinutes', () => {
  it('городская скорость по умолчанию — 30 км/ч', () => {
    expect(ASSUMED_SPEED_KMH).toBe(30);
  });

  it('5 км при 30 км/ч — 10 минут', () => {
    expect(estimateEtaMinutes(5)).toBe(10);
  });

  it('округляет до целых минут', () => {
    expect(estimateEtaMinutes(1)).toBe(2);
  });

  it('0 км — 0 минут', () => {
    expect(estimateEtaMinutes(0)).toBe(0);
  });
});
