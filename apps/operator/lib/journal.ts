import { api } from './api';

export type AuditActorType = 'OPERATOR' | 'SYSTEM';
export type AuditTargetType = 'MASTER_PROFILE' | 'USER' | 'ORDER' | 'PLANNED_ORDER' | 'DISPUTE';

export interface AuditLogRow {
  id: string;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  comment: string | null;
  createdAt: string;
  actor: { name: string | null; phone: string } | null;
}

export interface JournalPage {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

export const ACTION_LABELS: Record<string, string> = {
  MASTER_APPROVED: 'Верификация: одобрено',
  MASTER_REJECTED: 'Верификация: отклонено',
  MASTER_NEEDS_INFO: 'Верификация: запрошены данные',
  MASTER_AUTO_BLOCKED: 'Мастер заблокирован автоматически',
  USER_BLOCKED: 'Пользователь заблокирован',
  USER_UNBLOCKED: 'Пользователь разблокирован',
  ORDER_MANUALLY_ASSIGNED: 'Заказ: ручное назначение мастера',
  AUTO_CLOSED: 'Заказ закрыт автоматически',
  DISPUTE_RESOLVED: 'Спор разрешён',
};

export function fetchJournal(page: number): Promise<JournalPage> {
  return api(`/admin/journal?page=${page}`);
}
