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

/** Runtime shape validation: missing metrics are not zero or an empty workload. */
export function parseMetrics(value:unknown):DashboardMetrics {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid metrics response');
  const data=value as Record<string,unknown>;
  for(const key of ['activeUrgentCount','publishedPlannedCount','openDisputesCount','pendingVerificationCount','pendingWithdrawalsCount'])if(!Number.isSafeInteger(data[key])||(data[key] as number)<0)throw new Error('Invalid metric count');
  for(const key of ['foundMasterRate','medianSearchSeconds'])if(data[key]!==null&&(typeof data[key]!=='number'||!Number.isFinite(data[key])||(data[key] as number)<0))throw new Error('Invalid metric value');
  if(typeof data.foundMasterRate==='number'&&data.foundMasterRate>100)throw new Error('Invalid metric rate');
  if(!Array.isArray(data.stuckSearches)||!data.stuckSearches.every(row=>row&&typeof row==='object'&&typeof row.id==='string'&&row.id.trim()&&typeof row.category==='string'&&typeof row.address==='string'&&Number.isSafeInteger(row.wave)&&row.wave>=0&&typeof row.waitingSeconds==='number'&&Number.isFinite(row.waitingSeconds)&&row.waitingSeconds>=0)||new Set(data.stuckSearches.map(row=>row.id)).size!==data.stuckSearches.length)throw new Error('Invalid search metrics');
  return value as DashboardMetrics;
}
