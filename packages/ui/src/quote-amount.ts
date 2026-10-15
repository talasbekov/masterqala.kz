/** A known zero is different from an absent or malformed server amount. */
export function isKnownQuoteAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647;
}
