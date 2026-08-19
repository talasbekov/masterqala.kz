import { api } from './api';

export interface ActiveOrderClient {
  name: string;
  phone: string;
}

export interface ActiveOrderCategory {
  name: string;
}

export interface ActiveOrder {
  id: string;
  status: string;
  address: string;
  district: string;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  addressComment: string | null;
  description: string;
  lat: number | null;
  lng: number | null;
  calloutPrice: number;
  serviceFee: number;
  freePilot?: boolean;
  photos: { id: string }[];
  category: ActiveOrderCategory | null;
  client: ActiveOrderClient | null;
}

export async function fetchActiveOrder(): Promise<ActiveOrder | null> {
  const res = await api('/master/active-order');
  return (res.order ?? null) as ActiveOrder | null;
}

export async function setOnWay(orderId: string): Promise<void> {
  await api(`/orders/${orderId}/on-way`, { method: 'POST' });
}

export async function setOnSite(orderId: string): Promise<void> {
  await api(`/orders/${orderId}/on-site`, { method: 'POST' });
}

export async function proposePrice(orderId: string, amount: number, comment?: string): Promise<void> {
  await api(`/orders/${orderId}/propose-price`, {
    method: 'POST',
    body: JSON.stringify({ amount, comment: comment || undefined }),
  });
}

export async function completeOrder(orderId: string): Promise<void> {
  await api(`/orders/${orderId}/complete`, { method: 'POST' });
}

export async function cancelOrder(orderId: string): Promise<void> {
  await api(`/orders/${orderId}/cancel`, { method: 'POST' });
}
