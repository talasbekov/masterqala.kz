import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

type Dependency = {
  status: 'UP' | 'DOWN' | 'DISABLED';
  latencyMs?: number;
  enabled?: boolean;
  mode?: string;
  lastError?: string | null;
};

type SecurityAlert = {
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
};

type AuditEvent = {
  id: string;
  action: string;
  severity: string;
  outcome: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
};

type Dashboard = {
  generatedAt: string;
  readiness: {
    status: 'ready' | 'not_ready';
    environment: string;
    dependencies: {
      database: Dependency;
      queue: Dependency;
      scanner: Dependency;
    };
    backlog: {
      pendingScans: number;
      failedScans: number;
      staleScanning: number;
      openCriticalAlerts: number;
      openHighAlerts: number;
    };
    warnings: string[];
  };
  delivery: {
    enabled: boolean;
    channel: 'WEBHOOK';
    maxAttempts: number;
    timeoutMs: number;
  };
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
  recentEvents: AuditEvent[];
};

const SEVERITY_CLASS: Record<SecurityAlert['severity'], string> = {
  CRITICAL: 'border-red-300 bg-red-50 text-red-900',
  HIGH: 'border-orange-300 bg-orange-50 text-orange-900',
  WARNING: 'border-amber-300 bg-amber-50 text-amber-900',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function isOverdue(value: string | null) {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

function DependencyCard({ title, dependency }: { title: string; dependency: Dependency }) {
  const healthy = dependency.status === 'UP' || dependency.status === 'DISABLED';
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{title}</span>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${healthy ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
          {dependency.status}
        </span>
      </div>
      <div className="mt-2 text-sm text-gray-500">
        {dependency.latencyMs !== undefined && <span>{dependency.latencyMs} мс</span>}
        {dependency.mode && <span> · {dependency.mode}</span>}
      </div>
      {dependency.lastError && <p className="mt-2 break-words text-xs text-red-700">{dependency.lastError}</p>}
    </div>
  );
}

export default function AdminSecurityPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await api('/admin/security/dashboard');
      setDashboard(result);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function transition(alert: SecurityAlert, status: 'ACKNOWLEDGED' | 'RESOLVED') {
    const note = window.prompt(
      status === 'ACKNOWLEDGED' ? 'Комментарий оператора' : 'Как был устранён инцидент?',
      alert.operatorNote ?? '',
    );
    if (note === null) return;

    setActionId(`${alert.id}:${status}`);
    try {
      await api(`/admin/security/alerts/${alert.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });
      await load();
    } catch (transitionError) {
      setError((transitionError as Error).message);
    } finally {
      setActionId(null);
    }
  }

  async function assign(alert: SecurityAlert, assigneeUserId: string | null) {
    setActionId(`${alert.id}:assign`);
    try {
      await api(`/admin/security/alerts/${alert.id}/assignment`, {
        method: 'PATCH',
        body: JSON.stringify({ assigneeUserId }),
      });
      await load();
    } catch (assignError) {
      setError((assignError as Error).message);
    } finally {
      setActionId(null);
    }
  }

  async function retryDelivery(alert: SecurityAlert) {
    setActionId(`${alert.id}:retry`);
    try {
      await api(`/admin/security/alerts/${alert.id}/deliveries/retry`, { method: 'POST' });
      await load();
    } catch (retryError) {
      setError((retryError as Error).message);
    } finally {
      setActionId(null);
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl p-6 text-gray-500">Загрузка security dashboard…</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="text-sm text-gray-500">← Заявки мастеров</Link>
          <h1 className="mt-2 text-2xl font-bold">Безопасность платформы</h1>
          <p className="text-sm text-gray-500">Инфраструктура, SLA инцидентов, внешняя доставка и audit trail.</p>
        </div>
        <button className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" onClick={() => void load()}>
          Обновить
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {dashboard && (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Готовность</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${dashboard.readiness.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {dashboard.readiness.status === 'ready' ? 'READY' : 'NOT READY'}
              </span>
              <span className="text-xs text-gray-500">{dashboard.readiness.environment}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <DependencyCard title="PostgreSQL" dependency={dashboard.readiness.dependencies.database} />
              <DependencyCard title="pg-boss" dependency={dashboard.readiness.dependencies.queue} />
              <DependencyCard title="ClamAV" dependency={dashboard.readiness.dependencies.scanner} />
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Alert webhook</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${dashboard.delivery.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                    {dashboard.delivery.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{dashboard.delivery.timeoutMs} мс · {dashboard.delivery.maxAttempts} попыток</p>
              </div>
            </div>
            {dashboard.readiness.warnings.length > 0 && (
              <ul className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {dashboard.readiness.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
              </ul>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Открытые alerts', dashboard.metrics.openAlerts],
              ['Просрочено подтверждение', dashboard.metrics.overdueAcknowledgementAlerts],
              ['Просрочено решение', dashboard.metrics.overdueResolutionAlerts],
              ['Исчерпана доставка', dashboard.metrics.exhaustedDeliveries],
              ['Заражено за 24 ч', dashboard.metrics.infected24h],
              ['Ошибки scan за 24 ч', dashboard.metrics.scanFailed24h],
              ['Ожидают webhook', dashboard.metrics.pendingDeliveries],
              ['Audit events за 24 ч', dashboard.metrics.events24h],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="text-2xl font-bold">{value}</div>
                <div className="mt-1 text-sm text-gray-500">{label}</div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Открытые alerts</h2>
              <span className="text-xs text-gray-500">Старейший: {formatDate(dashboard.metrics.oldestOpenAlertAt)}</span>
            </div>
            <div className="space-y-3">
              {dashboard.alerts.map((alert) => {
                const actionPending = actionId?.startsWith(`${alert.id}:`) ?? false;
                const ackOverdue = alert.status === 'OPEN' && isOverdue(alert.acknowledgeBy);
                const resolveOverdue = alert.status === 'ACKNOWLEDGED' && isOverdue(alert.resolveBy);
                return (
                  <article key={alert.id} className={`rounded-xl border p-4 ${SEVERITY_CLASS[alert.severity]}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-bold">{alert.severity}</span>
                          <span className="rounded-full bg-white/70 px-2 py-1 text-xs">{alert.status}</span>
                          {alert.escalationLevel > 0 && <span className="rounded-full bg-red-700 px-2 py-1 text-xs text-white">ESC L{alert.escalationLevel}</span>}
                          {alert.occurrenceCount > 1 && <span className="text-xs">Повторений: {alert.occurrenceCount}</span>}
                        </div>
                        <h3 className="mt-2 font-semibold">{alert.title}</h3>
                        <p className="mt-1 break-all text-xs opacity-80">{alert.resourceType} · {alert.resourceId}</p>
                        <div className="mt-3 grid gap-1 text-xs opacity-90 sm:grid-cols-2">
                          <span>Ответственный: {alert.assignedToUserId === user?.id ? 'Вы' : alert.assignedToUserId ?? 'не назначен'}</span>
                          <span>Последнее событие: {formatDate(alert.lastSeenAt)}</span>
                          <span className={ackOverdue ? 'font-bold text-red-800' : ''}>Принять до: {formatDate(alert.acknowledgeBy)}</span>
                          <span className={resolveOverdue ? 'font-bold text-red-800' : ''}>Решить до: {formatDate(alert.resolveBy)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {alert.assignedToUserId !== user?.id && user && (
                          <button
                            disabled={actionPending}
                            className="rounded-lg border border-current bg-white/70 px-3 py-2 text-sm disabled:opacity-50"
                            onClick={() => void assign(alert, user.id)}
                          >
                            Назначить себе
                          </button>
                        )}
                        {alert.assignedToUserId === user?.id && (
                          <button
                            disabled={actionPending}
                            className="rounded-lg border border-current bg-white/70 px-3 py-2 text-sm disabled:opacity-50"
                            onClick={() => void assign(alert, null)}
                          >
                            Снять
                          </button>
                        )}
                        {alert.status === 'OPEN' && (
                          <button
                            disabled={actionPending}
                            className="rounded-lg border border-current bg-white/70 px-3 py-2 text-sm disabled:opacity-50"
                            onClick={() => void transition(alert, 'ACKNOWLEDGED')}
                          >
                            Принять
                          </button>
                        )}
                        {dashboard.delivery.enabled && (
                          <button
                            disabled={actionPending}
                            className="rounded-lg border border-current bg-white/70 px-3 py-2 text-sm disabled:opacity-50"
                            onClick={() => void retryDelivery(alert)}
                          >
                            Повторить webhook
                          </button>
                        )}
                        <button
                          disabled={actionPending}
                          className="rounded-lg border border-current bg-white/70 px-3 py-2 text-sm disabled:opacity-50"
                          onClick={() => void transition(alert, 'RESOLVED')}
                        >
                          Закрыть
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {dashboard.alerts.length === 0 && <div className="rounded-xl border p-6 text-center text-gray-500">Открытых alerts нет</div>}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Последние audit events</h2>
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Время</th>
                    <th className="p-3">Событие</th>
                    <th className="p-3">Уровень</th>
                    <th className="p-3">Ресурс</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dashboard.recentEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap p-3 text-gray-500">{formatDate(event.createdAt)}</td>
                      <td className="p-3 font-medium">{event.action}</td>
                      <td className="p-3">{event.severity} · {event.outcome}</td>
                      <td className="max-w-xs break-all p-3 text-xs text-gray-500">{event.resourceType} · {event.resourceId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-right text-xs text-gray-400">Обновлено: {formatDate(dashboard.generatedAt)}</p>
        </>
      )}
    </div>
  );
}
