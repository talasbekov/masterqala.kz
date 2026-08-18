import { api } from './api';

export type WithdrawalStatus = 'PENDING' | 'PAID' | 'FAILED' | 'ERROR';

export interface WithdrawalRow {
  id: string;
  masterUserId: string;
  amount: number;
  status: WithdrawalStatus;
  providerRef: string | null;
  /// Снимок Kaspi-номера мастера на момент заявки, маскированный (последние 4
  /// цифры) — отдельно от master.phone (логин-телефон). null у заявок,
  /// созданных до появления реквизитов.
  payoutPhone: string | null;
  errorMessage: string | null;
  requestedAt: string;
  paidAt: string | null;
  master: { phone: string };
}

export const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  PENDING: 'в обработке',
  PAID: 'выплачено',
  FAILED: 'отклонено · возврат',
  ERROR: 'ошибка · нужна сверка',
};

export function fetchWithdrawals(): Promise<WithdrawalRow[]> {
  return api('/admin/withdrawals');
}

export interface ResolveWithdrawalPayload {
  outcome: 'PAID' | 'FAILED';
  reference?: string;
  note: string;
}

export function resolveWithdrawal(id: string, payload: ResolveWithdrawalPayload): Promise<WithdrawalRow> {
  return api(`/admin/withdrawals/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function formatMaskedPhone(last4: string | null): string {
  if (!last4) return '—';
  const digits = last4.replace(/\D/g, '').padStart(4, '0');
  return `+7 ··· ${digits.slice(0, 2)} ${digits.slice(2)}`;
}
