import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  ArrowLeftIcon,
  Badge,
  Button,
  Card,
  EmptyState,
  ShieldIcon,
  SkeletonList,
  Table,
} from '@masterqala/ui';
import type { BadgeTone } from '@masterqala/ui';
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

/*
 * Тон бейджа несёт уровень серьёзности. Раньше уровень задавался фоном всей
 * карточки (red-50/orange-50/amber-50) — цвет был единственным носителем
 * смысла и терялся при дальтонизме. Теперь рядом с цветом всегда есть текст
 * уровня.
 */
const SEVERITY_TONES: Record<SecurityAlert['severity'], BadgeTone> = {
  CRITICAL: 'danger',
  HIGH: 'urgent',
  WARNING: 'warning',
};

const STATUS_TONES: Record<SecurityAlert['status'], BadgeTone> = {
  OPEN: 'warning',
  ACKNOWLEDGED: 'primary',
  RESOLVED: 'success',
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
    <Card>
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-ink">{title}</span>
        <Badge tone={healthy ? 'success' : 'danger'}>{dependency.status}</Badge>
      </div>
      <div className="mt-2 text-sm text-ink-soft">
        {dependency.latencyMs !== undefined && <span>{dependency.latencyMs} мс</span>}
        {dependency.mode && <span> · {dependency.mode}</span>}
      </div>
      {dependency.lastError && (
        <p className="mt-2 text-xs break-words text-danger">{dependency.lastError}</p>
      )}
    </Card>
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

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <SkeletonList rows={4} label="Загрузка security dashboard" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
            <ArrowLeftIcon size={16} />Заявки мастеров
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-ink">Безопасность платформы</h1>
          <p className="text-sm text-ink-soft">
            Инфраструктура, SLA инцидентов, внешняя доставка и audit trail.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          Обновить
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {dashboard && (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold text-ink">Готовность</h2>
              <Badge tone={dashboard.readiness.status === 'ready' ? 'success' : 'danger'}>
                {dashboard.readiness.status === 'ready' ? 'READY' : 'NOT READY'}
              </Badge>
              <span className="text-2xs text-ink-soft">{dashboard.readiness.environment}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <DependencyCard title="PostgreSQL" dependency={dashboard.readiness.dependencies.database} />
              <DependencyCard title="pg-boss" dependency={dashboard.readiness.dependencies.queue} />
              <DependencyCard title="ClamAV" dependency={dashboard.readiness.dependencies.scanner} />
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-ink">Alert webhook</span>
                  <Badge tone={dashboard.delivery.enabled ? 'success' : 'neutral'}>
                    {dashboard.delivery.enabled ? 'ENABLED' : 'DISABLED'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-ink-soft">
                  {dashboard.delivery.timeoutMs} мс · {dashboard.delivery.maxAttempts} попыток
                </p>
              </Card>
            </div>
            {dashboard.readiness.warnings.length > 0 && (
              <Alert tone="warning" title="Предупреждения готовности">
                <ul className="list-disc space-y-0.5 pl-4">
                  {dashboard.readiness.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Alert>
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
              <Card key={label}>
                <div className="text-2xl font-bold text-ink">{value}</div>
                <div className="mt-1 text-sm text-ink-soft">{label}</div>
              </Card>
            ))}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">Открытые alerts</h2>
              <span className="text-2xs text-ink-soft">
                Старейший: {formatDate(dashboard.metrics.oldestOpenAlertAt)}
              </span>
            </div>
            <div className="space-y-3">
              {dashboard.alerts.map((alert) => {
                const actionPending = actionId?.startsWith(`${alert.id}:`) ?? false;
                const ackOverdue = alert.status === 'OPEN' && isOverdue(alert.acknowledgeBy);
                const resolveOverdue = alert.status === 'ACKNOWLEDGED' && isOverdue(alert.resolveBy);
                return (
                  <Card as="article" key={alert.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={SEVERITY_TONES[alert.severity]}>{alert.severity}</Badge>
                          <Badge tone={STATUS_TONES[alert.status] ?? 'neutral'}>{alert.status}</Badge>
                          {alert.escalationLevel > 0 && (
                            <Badge tone="danger">ESC L{alert.escalationLevel}</Badge>
                          )}
                          {alert.occurrenceCount > 1 && (
                            <span className="text-2xs text-ink-soft">
                              Повторений: {alert.occurrenceCount}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 font-bold text-ink">{alert.title}</h3>
                        <p className="mt-1 text-xs break-all text-ink-soft">
                          {alert.resourceType} · {alert.resourceId}
                        </p>
                        <div className="mt-3 grid gap-1 text-xs text-ink-soft sm:grid-cols-2">
                          <span>
                            Ответственный:{' '}
                            {alert.assignedToUserId === user?.id
                              ? 'Вы'
                              : alert.assignedToUserId ?? 'не назначен'}
                          </span>
                          <span>Последнее событие: {formatDate(alert.lastSeenAt)}</span>
                          <span className={ackOverdue ? 'font-bold text-danger' : ''}>
                            Принять до: {formatDate(alert.acknowledgeBy)}
                          </span>
                          <span className={resolveOverdue ? 'font-bold text-danger' : ''}>
                            Решить до: {formatDate(alert.resolveBy)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {alert.assignedToUserId !== user?.id && user && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actionPending}
                            loading={actionId === `${alert.id}:assign`}
                            onClick={() => void assign(alert, user.id)}
                          >
                            Назначить себе
                          </Button>
                        )}
                        {alert.assignedToUserId === user?.id && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actionPending}
                            loading={actionId === `${alert.id}:assign`}
                            onClick={() => void assign(alert, null)}
                          >
                            Снять
                          </Button>
                        )}
                        {alert.status === 'OPEN' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actionPending}
                            loading={actionId === `${alert.id}:ACKNOWLEDGED`}
                            onClick={() => void transition(alert, 'ACKNOWLEDGED')}
                          >
                            Принять
                          </Button>
                        )}
                        {dashboard.delivery.enabled && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actionPending}
                            loading={actionId === `${alert.id}:retry`}
                            onClick={() => void retryDelivery(alert)}
                          >
                            Повторить webhook
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={actionPending}
                          loading={actionId === `${alert.id}:RESOLVED`}
                          onClick={() => void transition(alert, 'RESOLVED')}
                        >
                          Закрыть
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {dashboard.alerts.length === 0 && (
                <EmptyState
                  icon={<ShieldIcon size={32} />}
                  title="Открытых alerts нет"
                  subtitle="Все инциденты безопасности обработаны."
                />
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-ink">Последние audit events</h2>
            <Table<AuditEvent>
              caption="Последние события audit trail"
              className="rounded-lg border border-border bg-surface"
              columns={[
                {
                  key: 'createdAt',
                  header: 'Время',
                  cell: (event) => (
                    <span className="whitespace-nowrap text-ink-soft">{formatDate(event.createdAt)}</span>
                  ),
                },
                {
                  key: 'action',
                  header: 'Событие',
                  cell: (event) => <span className="font-bold">{event.action}</span>,
                },
                {
                  key: 'severity',
                  header: 'Уровень',
                  hideBelow: 'sm',
                  cell: (event) => `${event.severity} · ${event.outcome}`,
                },
                {
                  key: 'resource',
                  header: 'Ресурс',
                  hideBelow: 'md',
                  cell: (event) => (
                    <span className="block max-w-xs text-xs break-all text-ink-soft">
                      {event.resourceType} · {event.resourceId}
                    </span>
                  ),
                },
              ]}
              rows={dashboard.recentEvents}
              rowKey={(event) => event.id}
              empty={<EmptyState title="Событий нет" subtitle="Audit trail пока пуст." />}
            />
          </section>

          <p className="text-right text-2xs text-ink-muted">
            Обновлено: {formatDate(dashboard.generatedAt)}
          </p>
        </>
      )}
    </div>
  );
}
