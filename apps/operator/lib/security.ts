import { api } from './api';

export interface Dependency {
  status: 'UP' | 'DOWN' | 'DISABLED';
  latencyMs?: number;
  enabled?: boolean;
  mode?: string;
  lastError?: string | null;
}

export interface SecurityAlert {
  id: string;
  ruleKey: string;
  severity: 'WARNING' | 'HIGH' | 'CRITICAL';
  title: string;
  resourceType: string;
  resourceId: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  assignedToUserId: string | null;
  assignedAt: string | null;
  acknowledgeBy: string | null;
  resolveBy: string | null;
  escalatedAt: string | null;
  escalationLevel: number;
  operatorNote: string | null;
}

export interface SecurityAuditEvent {
  id: string;
  action: string;
  severity: string;
  outcome: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
}

export interface SecurityDashboard {
  generatedAt: string;
  readiness: {
    status: 'ready' | 'not_ready';
    environment: string;
    dependencies: { database: Dependency; queue: Dependency; scanner: Dependency };
    backlog: {
      pendingScans: number;
      failedScans: number;
      staleScanning: number;
      openCriticalAlerts: number;
      openHighAlerts: number;
    };
    warnings: string[];
  };
  delivery: { enabled: boolean; channel: 'WEBHOOK'; maxAttempts: number; timeoutMs: number };
  metrics: {
    events24h: number;
    infected24h: number;
    scanFailed24h: number;
    openAlerts: number;
    acknowledgedAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    warningAlerts: number;
    overdueAcknowledgementAlerts: number;
    overdueResolutionAlerts: number;
    pendingDeliveries: number;
    exhaustedDeliveries: number;
    oldestOpenAlertAt: string | null;
  };
  alerts: SecurityAlert[];
  recentEvents: SecurityAuditEvent[];
}

export function fetchSecurityDashboard(): Promise<SecurityDashboard> {
  return api('/admin/security/dashboard');
}

export async function transitionAlert(
  id: string,
  status: 'ACKNOWLEDGED' | 'RESOLVED',
  note?: string,
): Promise<void> {
  await api(`/admin/security/alerts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note: note || undefined }),
  });
}

export async function assignAlert(id: string, assigneeUserId: string | null): Promise<void> {
  await api(`/admin/security/alerts/${id}/assignment`, {
    method: 'PATCH',
    body: JSON.stringify({ assigneeUserId }),
  });
}

export async function retryAlertDelivery(id: string): Promise<void> {
  await api(`/admin/security/alerts/${id}/deliveries/retry`, { method: 'POST' });
}
