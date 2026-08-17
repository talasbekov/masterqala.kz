import { api } from './api';

export interface StuckSearch {
  id: string;
  category: string;
  address: string;
  wave: number;
  waitingSeconds: number;
}

export interface DashboardMetrics {
  activeUrgentCount: number;
  publishedPlannedCount: number;
  foundMasterRate: number | null;
  medianSearchSeconds: number | null;
  openDisputesCount: number;
  pendingVerificationCount: number;
  pendingWithdrawalsCount: number;
  stuckSearches: StuckSearch[];
}

export function fetchMetrics(): Promise<DashboardMetrics> {
  return api('/admin/metrics');
}
