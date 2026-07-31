import { api } from './api';

export type MasterStatus = 'PENDING_REVIEW' | 'NEEDS_INFO' | 'ACTIVE' | 'REJECTED';
export type DecisionType = 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
export type DocumentType = 'ID_CARD' | 'QUALIFICATION';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ID_CARD: 'Удостоверение личности',
  QUALIFICATION: 'Подтверждение квалификации',
};

export const MASTER_STATUS_LABELS: Record<MasterStatus, string> = {
  PENDING_REVIEW: 'на проверке',
  NEEDS_INFO: 'нужны данные',
  ACTIVE: 'активен',
  REJECTED: 'отклонён',
};

export interface ApplicationListItem {
  id: string;
  fullName: string;
  district: string;
  status: MasterStatus;
  createdAt: string;
  user: { phone: string };
  categories: { category: { name: string } }[];
}

export interface ApplicationDocument {
  id: string;
  masterProfileId: string;
  type: DocumentType;
  filePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  scanStatus: string;
  scannedAt: string | null;
  cdrStatus: string;
}

export interface ApplicationDecisionRecord {
  decision: DecisionType;
  comment: string | null;
  createdAt: string;
  operator: { name: string | null; phone: string };
}

export interface ApplicationDetail {
  id: string;
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  status: MasterStatus;
  rejectionReason: string | null;
  createdAt: string;
  user: { phone: string };
  categories: { category: { name: string } }[];
  documents: ApplicationDocument[];
  decisions: ApplicationDecisionRecord[];
}

export function fetchApplications(): Promise<ApplicationListItem[]> {
  return api('/admin/applications');
}

export function fetchApplication(id: string): Promise<ApplicationDetail> {
  return api(`/admin/applications/${id}`);
}

export async function decideApplication(id: string, decision: DecisionType, comment?: string): Promise<void> {
  await api(`/admin/applications/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, comment }),
  });
}

/**
 * Отражает гейт бэкенда в `AdminService.getDocumentStream` — до того, как
 * оба условия выполнены, запрос файла вернёт 404, значит не показываем
 * документ кликабельным.
 */
export function documentIsViewable(doc: ApplicationDocument): boolean {
  return doc.scanStatus === 'CLEAN' && ['NOT_REQUIRED', 'SANITIZED', 'BYPASSED'].includes(doc.cdrStatus);
}
