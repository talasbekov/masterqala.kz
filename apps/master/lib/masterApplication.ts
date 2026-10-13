import { api, apiUpload, ApiError } from './api';

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface ApplicationDocument {
  id: string;
  type: string;
  originalName: string;
  scanStatus?: 'PENDING_SCAN'|'SCANNING'|'CLEAN'|'INFECTED'|'SCAN_FAILED';
  scannedAt?:string|null;
  cdrStatus?:'NOT_REQUIRED'|'PENDING'|'SANITIZED'|'BYPASSED'|'CDR_FAILED';
}

export type ApplicationStatus = 'PENDING_REVIEW' | 'NEEDS_INFO' | 'ACTIVE' | 'REJECTED';

export interface Application {
  id: string;
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  status: ApplicationStatus;
  rejectionReason: string | null;
  latestDecisionComment: string | null;
  blockedUntil: string | null;
  categories: { category: Category }[];
  documents: ApplicationDocument[];
}

export const APPLICATION_STATUS_RU: Record<ApplicationStatus, string> = {
  PENDING_REVIEW: 'На проверке',
  NEEDS_INFO: 'Нужны дополнительные данные',
  ACTIVE: 'Активен — вы мастер!',
  REJECTED: 'Отклонена',
};

export const DOCUMENT_TYPES = [
  { value: 'ID_CARD', label: 'Удостоверение личности' },
  { value: 'QUALIFICATION', label: 'Подтверждение квалификации' },
] as const;

export async function fetchCategories(): Promise<Category[]> {
  return api('/categories');
}

export async function fetchApplication(): Promise<Application | null> {
  try {
    return await api('/masters/application');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export interface ApplicationFormValues {
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  categoryIds: string[];
}

export async function submitApplication(values: ApplicationFormValues): Promise<Application> {
  return api('/masters/application', {
    method: 'POST',
    body: JSON.stringify(values),
  });
}

export async function uploadApplicationDocument(type: string, file: File,options:{signal?:AbortSignal}={}): Promise<unknown> {
  const fd = new FormData();
  fd.append('type', type);
  fd.append('file', file);
  return apiUpload('/masters/application/documents', fd,options);
}
