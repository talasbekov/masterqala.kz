import { api } from './api';

export interface MasterStats {
  completedCount: number;
  earnings: number;
  rating: number | null;
  reviewCount: number;
}

export function fetchMasterStats(): Promise<MasterStats> {
  return api('/masters/me/stats');
}
