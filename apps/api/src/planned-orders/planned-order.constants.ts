import { Prisma } from '@prisma/client';

export const PLANNED_HORIZON_DAYS = 14;
export const PLANNED_MAX_BIDS = 5;
export const PLANNED_CONFIRM_TIMEOUT_S = 2 * 3600;
export const PLANNED_AUTO_CLOSE_S = 24 * 3600;

export const PLANNED_ORDER_INCLUDE = {
  category: true,
  master: { select: { id: true, name: true, phone: true } },
  client: { select: { id: true, name: true, phone: true } },
  bids: {
    include: {
      master: {
        select: {
          id: true,
          name: true,
          masterProfile: { select: { experienceYears: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  photos: true,
} satisfies Prisma.PlannedOrderInclude;

export const FEED_SELECT = {
  id: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  district: true,
  description: true,
  slotStart: true,
  slotEnd: true,
  budget: true,
  status: true,
  createdAt: true,
  _count: { select: { bids: true } },
} satisfies Prisma.PlannedOrderSelect;
