import { api } from './api';

export interface OperatorUserRow {
  id: string;
  name: string | null;
  phone: string;
  role: string;
  orders: number;
  isBlocked: boolean;
}

export function fetchUsers(search?: string): Promise<OperatorUserRow[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return api(`/admin/users${query}`);
}

export async function blockUser(id: string, reason: string): Promise<void> {
  await api(`/admin/users/${id}/block`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export async function unblockUser(id: string): Promise<void> {
  await api(`/admin/users/${id}/unblock`, { method: 'POST' });
}
