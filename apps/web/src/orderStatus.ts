import type { StatusVariant } from '@masterqala/ui';

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

export const STEPPER_STEPS = [
  { status: 'ACCEPTED', label: 'Принята' },
  { status: 'MASTER_ON_WAY', label: 'Мастер в пути' },
  { status: 'INSPECTION', label: 'Осмотр' },
  { status: 'AWAITING_PRICE_CONFIRM', label: 'Согласование цены' },
  { status: 'IN_PROGRESS', label: 'В работе' },
  { status: 'DONE', label: 'Выполнена' },
  { status: 'CLOSED', label: 'Закрыта' },
];

export function isTerminalStatus(s: string): boolean {
  return ['CLOSED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER'].includes(s);
}

export const WAVE_TEXTS: Record<number, string> = {
  0: 'Начинаем поиск…',
  1: 'Ищем мастера в радиусе 3 км…',
  2: 'Расширяем поиск до 6 км…',
  3: 'Расширяем поиск до 10 км…',
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

export function isPlannedTerminalStatus(s: string): boolean {
  return ['CLOSED', 'EXPIRED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_MASTER'].includes(s);
}

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
  DISPUTE: 'danger',
};

export function urgentStatusVariant(status: string): StatusVariant {
  return URGENT_VARIANTS[status] ?? 'info';
}

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
  DISPUTE: 'danger',
};

export function plannedStatusVariant(status: string): StatusVariant {
  return PLANNED_VARIANTS[status] ?? 'info';
}
