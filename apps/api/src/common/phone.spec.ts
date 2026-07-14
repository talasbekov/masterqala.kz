import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['+77071234567', '+77071234567'],
    ['87071234567', '+77071234567'],
    ['77071234567', '+77071234567'],
    ['8 (707) 123-45-67', '+77071234567'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each([
    ['12345'],
    ['+1202555'],
    ['abc'],
    [''],
    ['abc87071234567'],
    ['+1 707 123 45 67'],
    ['8707123456789'],
    ['87071234567x'],
  ])('%s → null', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});
