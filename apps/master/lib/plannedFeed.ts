import { api } from './api';

export type CommercialMode = 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE';

export interface PlannedFeedItem {
  id: string;
  commercialMode: CommercialMode;
  category: { name: string } | null;
  district: string;
  description: string;
  slotStart: string;
  slotEnd: string;
  _count: { bids: number };
}

export interface PlannedOrderDetail extends PlannedFeedItem {
  budget: number | null;
}

export async function fetchPlannedFeed(): Promise<PlannedFeedItem[]> {
  return api('/planned-orders/feed');
}

export async function fetchPlannedOrder(id: string): Promise<PlannedOrderDetail> {
  return api(`/planned-orders/${id}`);
}

export interface BidValues {
  price: number;
  term: string;
  comment?: string;
}

export async function submitBid(plannedOrderId: string, values: BidValues): Promise<void> {
  await api(`/planned-orders/${plannedOrderId}/bids`, {
    method: 'POST',
    body: JSON.stringify({ price: values.price, term: values.term, comment: values.comment || undefined }),
  });
}
