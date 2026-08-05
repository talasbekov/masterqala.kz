import { api } from './api';

export type DisputeStatus = 'OPEN' | 'RESOLVED';
export type DisputeRole = 'CLIENT' | 'MASTER';
export type CommercialMode = 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE' | null;

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: 'Открыт',
  RESOLVED: 'Разрешён',
};

export const DISPUTE_ROLE_LABELS: Record<DisputeRole, string> = {
  CLIENT: 'клиент',
  MASTER: 'мастер',
};

export interface DisputeListRow {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  openedByRole: DisputeRole;
  status: DisputeStatus;
  createdAt: string;
}

export interface DisputeDetail {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  openedByRole: DisputeRole;
  reason: string;
  counterStatement: string | null;
  evidenceDocIds: string[];
  status: DisputeStatus;
  commercialMode: CommercialMode;
  refundServiceFee: boolean | null;
  penalizeMaster: boolean | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

export function fetchDisputes(status?: DisputeStatus): Promise<DisputeListRow[]> {
  const query = status ? `?status=${status}` : '';
  return api(`/admin/disputes${query}`);
}

export function fetchDispute(id: string): Promise<DisputeDetail> {
  return api(`/admin/disputes/${id}`);
}

export interface ResolveDisputePayload {
  refundServiceFee: boolean;
  penalizeMaster: boolean;
  resolutionNote: string;
}

export function resolveDispute(id: string, payload: ResolveDisputePayload): Promise<DisputeDetail> {
  return api(`/admin/disputes/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
