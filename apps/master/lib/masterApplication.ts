import { api, apiUpload } from './api';

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface ApplicationDocument {
  id: string;
  type: string;
  originalName: string;
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
  } catch {
    return null;
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

export async function uploadApplicationDocument(type: string, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append('type', type);
  fd.append('file', file);
  return apiUpload('/masters/application/documents', fd);
}
