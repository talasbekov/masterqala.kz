import { api } from './api';

export type WithdrawalStatus = 'PENDING' | 'PAID' | 'FAILED';

export interface WithdrawalRow {
  id: string;
  masterUserId: string;
  amount: number;
  status: WithdrawalStatus;
  providerRef: string | null;
  requestedAt: string;
  paidAt: string | null;
  master: { phone: string };
}

export const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  PENDING: 'в обработке',
  PAID: 'выплачено',
  FAILED: 'отклонено · возврат',
};

export function fetchWithdrawals(): Promise<WithdrawalRow[]> {
  return api('/admin/withdrawals');
}

export function formatMaskedPhone(last4: string): string {
  const digits = last4.replace(/\D/g, '').padStart(4, '0');
  return `+7 ··· ${digits.slice(0, 2)} ${digits.slice(2)}`;
}
