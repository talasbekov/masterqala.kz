import { api } from './api';

export type OrderType = 'urgent' | 'planned';

export const TYPE_LABELS: Record<OrderType, string> = {
  urgent: 'Срочный',
  planned: 'Плановый',
};

export const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Создана',
  SEARCHING: 'Поиск мастера',
  ACCEPTED: 'Принята',
  MASTER_ON_WAY: 'Мастер в пути',
  INSPECTION: 'Осмотр',
  AWAITING_PRICE_CONFIRM: 'Согласование цены',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнена',
  CLOSED: 'Закрыта',
  NO_MASTERS: 'Мастера не найдены',
  CANCELLED_BY_CLIENT: 'Отменена клиентом',
  CANCELLED_BY_MASTER: 'Отменена мастером',
  DISPUTE: 'Спор',
};

export const PLANNED_STATUS_LABELS: Record<string, string> = {
  CREATED: 'Создана',
  PUBLISHED: 'Опубликована',
  MASTER_SELECTED: 'Мастер выбран',
  CONFIRMED: 'Подтверждена',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнена',
  CLOSED: 'Закрыта',
  EXPIRED: 'Истекла',
  CANCELLED_BY_CLIENT: 'Отменена клиентом',
  CANCELLED_BY_MASTER: 'Отменена мастером',
  DISPUTE: 'Спор',
};

export type StatusVariant = 'info' | 'active' | 'success' | 'danger' | 'warning';

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  info: 'bg-fill-soft text-primary',
  active: 'bg-fill-soft text-primary',
  success: 'bg-success-bg text-success-ink',
  danger: 'bg-danger-bg text-danger',
  warning: 'bg-warning-bg text-warning-ink',
};

const URGENT_VARIANTS: Record<string, StatusVariant> = {
  CREATED: 'info',
  SEARCHING: 'info',
  ACCEPTED: 'active',
  MASTER_ON_WAY: 'active',
  INSPECTION: 'active',
  AWAITING_PRICE_CONFIRM: 'active',
  IN_PROGRESS: 'active',
  DONE: 'success',
  CLOSED: 'success',
  NO_MASTERS: 'danger',
  CANCELLED_BY_CLIENT: 'danger',
  CANCELLED_BY_MASTER: 'danger',
  DISPUTE: 'warning',
};

const PLANNED_VARIANTS: Record<string, StatusVariant> = {
  CREATED: 'info',
  PUBLISHED: 'info',
  MASTER_SELECTED: 'active',
  CONFIRMED: 'active',
  IN_PROGRESS: 'active',
  DONE: 'success',
  CLOSED: 'success',
  EXPIRED: 'danger',
  CANCELLED_BY_CLIENT: 'danger',
  CANCELLED_BY_MASTER: 'danger',
  DISPUTE: 'warning',
};

export function statusLabel(type: OrderType, status: string): string {
  return (type === 'planned' ? PLANNED_STATUS_LABELS : STATUS_LABELS)[status] ?? status;
}

export function statusPillClass(type: OrderType, status: string): string {
  const variant = (type === 'planned' ? PLANNED_VARIANTS : URGENT_VARIANTS)[status] ?? 'info';
  return VARIANT_CLASSES[variant];
}

export interface OrderListRow {
  id: string;
  type: OrderType;
  client: string;
  master: string | null;
  category: string;
  status: string;
  createdAt: string;
}

export interface OrderTimelineEvent {
  at: string;
  event: string;
}

interface OrderDetailBase {
  id: string;
  status: string;
  address: string;
  district: string;
  createdAt: string;
  client: { name: string | null; phone: string };
  master: { name: string | null; phone: string } | null;
  category: string;
  workPrice: number | null;
  timeline: OrderTimelineEvent[];
  canAssign: boolean;
}

export type OrderDetail =
  | (OrderDetailBase & { type: 'urgent'; calloutPrice: number; serviceFee: number })
  | (OrderDetailBase & { type: 'planned'; budget: number | null });

export interface AssignCandidate {
  masterUserId: string;
  name: string;
  distanceKm: number;
  isOnline: boolean;
}

export function fetchOrders(params: { type?: OrderType; status?: string; search?: string }): Promise<OrderListRow[]> {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  const query = q.toString() ? `?${q.toString()}` : '';
  return api(`/admin/orders${query}`);
}

export function fetchOrder(id: string, type: OrderType): Promise<OrderDetail> {
  return api(`/admin/orders/${id}?type=${type}`);
}

export function fetchCandidates(id: string): Promise<AssignCandidate[]> {
  return api(`/admin/orders/${id}/candidates?type=urgent`);
}

export async function assignMaster(id: string, masterUserId: string): Promise<void> {
  await api(`/admin/orders/${id}/assign?type=urgent`, {
    method: 'POST',
    body: JSON.stringify({ masterUserId }),
  });
}
