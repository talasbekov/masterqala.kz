const MAX_AMOUNT = 2147483647;

/** Complete stored components only: an absent amount is never implicitly zero. */
export function storedQuoteTotal(order: {
  workPrice?: number | null;
  materialsPrice?: number | null;
  calloutPrice?: number | null;
}): number | null {
  const { workPrice, materialsPrice, calloutPrice } = order;
  const known = (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_AMOUNT;
  if (!known(workPrice) || !known(materialsPrice) || !known(calloutPrice))
    return null;
  const total = workPrice + materialsPrice + calloutPrice;
  return total <= MAX_AMOUNT ? total : null;
}

export function versionedQuoteTotal(
  order: Parameters<typeof storedQuoteTotal>[0] & {
    quoteVersion?: number | null;
  },
): number | null {
  return typeof order.quoteVersion === 'number' &&
    Number.isInteger(order.quoteVersion) &&
    order.quoteVersion > 0
    ? storedQuoteTotal(order)
    : null;
}
