import { OrderStatus, Prisma } from '@prisma/client';

export const WAVE_RADII_M = [3000, 6000, 10000];
export const WAVE_TIMEOUTS_S = [60, 60, 90];
export const MAX_WAVE = 3;
export const PRICE_CONFIRM_TIMEOUT_S = 15 * 60;
export const AUTO_CLOSE_S = 24 * 3600;

export const ACTIVE_MASTER_STATUSES: OrderStatus[] = [
  'ACCEPTED',
  'MASTER_ON_WAY',
  'INSPECTION',
  'AWAITING_PRICE_CONFIRM',
  'IN_PROGRESS',
];

export const ACTIVE_CLIENT_STATUSES: OrderStatus[] = [
  'CREATED',
  'SEARCHING',
  'NO_MASTERS',
  ...ACTIVE_MASTER_STATUSES,
  'DONE',
];

export const ORDER_INCLUDE = {
  category: true,
  master: { select: { id: true, name: true, phone: true } },
  client: { select: { id: true, name: true, phone: true } },
  photos: true,
  review: { select: { rating: true, comment: true } },
} satisfies Prisma.OrderInclude;
