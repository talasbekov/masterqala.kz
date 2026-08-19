import { api, apiUpload } from './api';

export type DisputeStatus = 'OPEN' | 'RESOLVED';

export interface DisputeSummary {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  status: DisputeStatus;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DisputeDetail extends DisputeSummary {
  counterStatement: string | null;
  resolutionNote: string | null;
  refundServiceFee: boolean | null;
  penalizeMaster: boolean | null;
}

export interface DisputeEvidence {
  id: string;
  uploadedByUserId: string;
  isMine: boolean;
  mimeType: string;
  scanStatus: string;
  createdAt: string;
}

export async function fetchMyDisputes(): Promise<DisputeSummary[]> {
  return api('/disputes/mine');
}

export async function fetchDisputeContext(
  kind: 'orders' | 'planned-orders',
  id: string,
): Promise<{ dispute: DisputeDetail | null; [key: string]: unknown }> {
  return api(`/${kind}/${id}`);
}

export async function fetchDisputeEvidence(disputeId: string): Promise<DisputeEvidence[]> {
  return api(`/disputes/${disputeId}/evidence`);
}

export async function submitCounterStatement(disputeId: string, counterStatement: string): Promise<DisputeDetail> {
  return api(`/disputes/${disputeId}`, { method: 'PATCH', body: JSON.stringify({ counterStatement }) });
}

export async function uploadDisputeEvidence(disputeId: string, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append('file', file);
  return apiUpload(`/disputes/${disputeId}/evidence`, fd);
}
