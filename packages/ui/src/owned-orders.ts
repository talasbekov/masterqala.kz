export interface OwnedOrderFields {
  id: string;
  status: string;
  description?: string | null;
  address?: string | null;
  category?: {name: string} | null;
  master?: {name: string | null} | null;
  createdAt?: string | null;
  workPrice?: number | null;
}
export type OwnedOrderItem = (OwnedOrderFields & {
  kind: 'urgent'; lifecycleVersion?: number; commercialMode?: string;
  quoteVersion?: number | null; quoteTotal?: number | null; calloutPrice?: number | null;
  cancellationAmount?: number | null; departedAt?: string | null;
}) | (OwnedOrderFields & {kind: 'planned'; budget?: number | null});
export type OwnedOrderAmount = {label: 'total' | 'cancelAmount' | 'moneyUnknown'; amount: number | null};
const validAmount = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export function presentOwnedOrderAmount(item: OwnedOrderItem): OwnedOrderAmount | null {
  if (item.kind === 'urgent' && (item.lifecycleVersion ?? 0) >= 2 && item.commercialMode === 'DIRECT_PAYMENT') {
    if (['CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER'].includes(item.status)) {
      const amount = validAmount(item.cancellationAmount);
      return amount !== null && (item.departedAt || amount > 0) ? {label: 'cancelAmount', amount} : null;
    }
    return typeof item.quoteVersion === 'number' && Number.isSafeInteger(item.quoteVersion) && item.quoteVersion > 0
      ? {label: 'total', amount: validAmount(item.quoteTotal)}
      : {label: 'moneyUnknown', amount: null};
  }
  return {label: 'total', amount: validAmount(item.workPrice ?? (item.kind === 'urgent' ? item.calloutPrice : item.budget))};
}
export function isOwnedOrderActive(item: Pick<OwnedOrderItem, 'kind' | 'status'>): boolean {
  return !['CLOSED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER', ...(item.kind === 'planned' ? ['EXPIRED'] : [])].includes(item.status);
}
