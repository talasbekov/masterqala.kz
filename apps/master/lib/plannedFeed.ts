import { api } from './api';
import type { OrderDispute } from '@masterqala/ui';

export type CommercialMode = 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE';
export interface PlannedBid { id: string; masterUserId: string; price: number; term: string; comment?: string | null }

export interface PlannedFeedItem {
  id: string;
  commercialMode: CommercialMode;
  lifecycleModel: 'LEGACY' | 'PLATFORM_V1_RESERVED';
  status: string;
  category: { name: string; slug?: string } | null;
  district: string;
  description: string;
  budget: number | null;
  slotStart: string;
  slotEnd: string;
  _count?: { bids: number };
}

export interface PlannedOrderDetail extends PlannedFeedItem {
  masterId: string | null; selectedBidId?: string | null; ownBid?: PlannedBid | null; bids?: PlannedBid[];
  address?: string | null; entrance?: string | null; floor?: string | null; apartment?: string | null;
  addressComment?: string | null; client?: { name?: string | null; phone?: string | null } | null;
  confirmDeadline?: string | null; workPrice?: number | null;
  closedAt?: string | null; dispute?: OrderDispute | null;
}
export type PlannedAction = 'bids' | 'confirm' | 'decline' | 'on-site' | 'complete' | 'cancel';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function parsePlannedItem(value: unknown): PlannedFeedItem {
  if (!record(value) || typeof value.id !== 'string' || !value.id || typeof value.status !== 'string' ||
    typeof value.description !== 'string' || typeof value.district !== 'string' ||
    typeof value.slotStart !== 'string' || !Number.isFinite(Date.parse(value.slotStart)) ||
    typeof value.slotEnd !== 'string' || !Number.isFinite(Date.parse(value.slotEnd)) ||
    !['LEGACY', 'PLATFORM_V1_RESERVED'].includes(String(value.lifecycleModel)) ||
    !['FREE_PILOT', 'PAID_MOCK', 'PAID_LIVE'].includes(String(value.commercialMode)) ||
    !(value.category === null || record(value.category) && typeof value.category.name === 'string') ||
    !(value.budget === null || typeof value.budget === 'number' && Number.isFinite(value.budget))) throw new Error('Invalid planned order');
  return value as unknown as PlannedFeedItem;
}
export function parsePlannedFeed(value: unknown): PlannedFeedItem[] {
  if (!Array.isArray(value)) throw new Error('Invalid planned feed');
  return value.map(parsePlannedItem).filter(order => order.lifecycleModel === 'LEGACY' && order.status === 'PUBLISHED');
}
export function parsePlannedDetail(value: unknown, id: string, ownerId: string, assignedOnly: boolean): PlannedOrderDetail {
  const item = parsePlannedItem(value) as PlannedOrderDetail;
  if (item.id !== id || item.lifecycleModel !== 'LEGACY' ||
    !(item.masterId === ownerId || !assignedOnly && item.masterId === null && item.status === 'PUBLISHED')) throw new Error('Planned order unavailable');
  return item;
}
export function ownPlannedBid(order: PlannedOrderDetail, ownerId: string): PlannedBid | null {
  const candidate = order.ownBid ?? order.bids?.find(bid => bid.masterUserId === ownerId);
  return candidate?.masterUserId === ownerId ? candidate : null;
}
export function plannedActions(order: PlannedOrderDetail, ownerId: string): PlannedAction[] {
  if (order.lifecycleModel !== 'LEGACY') return [];
  if (order.masterId === ownerId) {
    if (order.status === 'MASTER_SELECTED') return ['confirm', 'decline'];
    if (order.status === 'CONFIRMED') return ['on-site', 'cancel'];
    if (order.status === 'IN_PROGRESS') return ['complete', 'cancel'];
  }
  if (order.masterId === null && order.status === 'PUBLISHED' && !ownPlannedBid(order, ownerId) &&
      (order._count?.bids ?? order.bids?.length ?? 5) < 5) return ['bids'];
  return [];
}
export function validBid(values: BidValues): boolean {
  return Number.isSafeInteger(values.price) && values.price >= 1 && values.term.trim().length > 0 &&
    values.term.length <= 200 && (values.comment?.length ?? 0) <= 1000;
}

export async function fetchPlannedFeed(): Promise<PlannedFeedItem[]> {
  return parsePlannedFeed(await api('/planned-orders/feed'));
}

export async function fetchPlannedOrder(id: string): Promise<PlannedOrderDetail> {
  return api(`/planned-orders/${encodeURIComponent(id)}`);
}

export interface BidValues {
  price: number;
  term: string;
  comment?: string;
}

export async function submitBid(plannedOrderId: string, values: BidValues): Promise<void> {
  await api(`/planned-orders/${encodeURIComponent(plannedOrderId)}/bids`, {
    method: 'POST',
    body: JSON.stringify({ price: values.price, term: values.term, comment: values.comment || undefined }),
  });
}
