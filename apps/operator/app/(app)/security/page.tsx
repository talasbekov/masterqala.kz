'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  SkeletonList,
  Table,
  type BadgeTone,
  type TableColumn,
} from '@masterqala/ui';
import { useAuth } from '@/lib/auth';
import { SecurityAlertCard } from '@/components/SecurityAlertCard';
import {
  fetchSecurityDashboard,
  transitionAlert,
  assignAlert,
  retryAlertDelivery,
  type SecurityDashboard,
  type SecurityAlert,
  type Dependency,
} from '@/lib/security';

type AuditEvent = SecurityDashboard['recentEvents'][number];

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}

function isOverdue(value: string | null): boolean {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

function DependencyCard({ title, dependency }: { title: string; dependency: Dependency }) {
  const healthy = dependency.status === 'UP' || dependency.status === 'DISABLED';
  const tone: BadgeTone = healthy ? 'success' : 'danger';
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold text-ink">{title}</h3>
        <Badge tone={tone}>{dependency.status}</Badge>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        {dependency.latencyMs !== undefined && <span>{dependency.latencyMs} мс</span>}
        {dependency.mode && <span> · {dependency.mode}</span>}
      </p>
      {dependency.lastError && <p className="mt-2 break-words text-xs text-danger">{dependency.lastError}</p>}
    </Card>
  );
}

export default function SecurityPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<{ alertId: string; status: 'ACKNOWLEDGED' | 'RESOLVED' } | null>(null);
  const [formNote, setFormNote] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await fetchSecurityDashboard();
      setDashboard(result);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void load();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function manualRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function startForm(alert: SecurityAlert, status: 'ACKNOWLEDGED' | 'RESOLVED') {
    setOpenForm({ alertId: alert.id, status });
    setFormNote(alert.operatorNote ?? '');
  }

  function cancelForm() {
    setOpenForm(null);
    setFormNote('');
  }

  async function submitForm() {
    if (!openForm) return;
    setActionId(`${openForm.alertId}:${openForm.status}`);
    try {
      await transitionAlert(openForm.alertId, openForm.status, formNote.trim());
      setOpenForm(null);
      setFormNote('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  }

  async function assign(alert: SecurityAlert, assigneeUserId: string | null) {
    setActionId(`${alert.id}:assign`);
    try {
      await assignAlert(alert.id, assigneeUserId);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  }

  async function retryDelivery(alert: SecurityAlert) {
    setActionId(`${alert.id}:retry`);
    try {
      await retryAlertDelivery(alert.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActionId(null);
    }
  }

  const eventColumns: TableColumn<AuditEvent>[] = [
    {
      key: 'when',
      header: 'Время',
      width: '170px',
      cell: (event) => <span className="text-ink-soft">{formatDate(event.createdAt)}</span>,
    },
    {
      key: 'event',
      header: 'Событие',
      cell: (event) => (
        <span className="font-bold text-ink">
          {event.action}{' '}
          <span className="font-normal text-ink-soft">
            · {event.severity} · {event.outcome}
          </span>
        </span>
      ),
    },
    {
      key: 'resource',
      header: 'Ресурс',
      width: '180px',
      hideBelow: 'md',
      cell: (event) => (
        <span className="text-xs text-ink-soft">
          {event.resourceType} · {event.resourceId}
        </span>
      ),
    },
  ];

  if (loading) return <SkeletonList rows={5} label="Загрузка security dashboard" className="p-4 lg:p-8" />;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Безопасность платформы</h1>
          <p className="text-sm text-ink-soft">Инфраструктура, SLA инцидентов, внешняя доставка и audit trail.</p>
        </div>
        <Button variant="secondary" loading={refreshing} onClick={() => void manualRefresh()}>
          Обновить
        </Button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {dashboard && (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-extrabold text-ink">Готовность</h2>
              <Badge tone={dashboard.readiness.status === 'ready' ? 'success' : 'danger'}>
                {dashboard.readiness.status === 'ready' ? 'READY' : 'NOT READY'}
              </Badge>
              <span className="text-xs text-ink-soft">{dashboard.readiness.environment}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DependencyCard title="PostgreSQL" dependency={dashboard.readiness.dependencies.database} />
              <DependencyCard title="pg-boss" dependency={dashboard.readiness.dependencies.queue} />
              <DependencyCard title="ClamAV" dependency={dashboard.readiness.dependencies.scanner} />
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold text-ink">Alert webhook</h3>
                  <Badge tone={dashboard.delivery.enabled ? 'success' : 'neutral'}>
                    {dashboard.delivery.enabled ? 'ENABLED' : 'DISABLED'}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                  {dashboard.delivery.timeoutMs} мс · {dashboard.delivery.maxAttempts} попыток
                </p>
              </Card>
            </div>
            {dashboard.readiness.warnings.length > 0 && (
              <Alert tone="warning" title="Предупреждения готовности">
                <ul className="list-disc pl-4">
                  {dashboard.readiness.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ['Открытые alerts', dashboard.metrics.openAlerts],
                ['Просрочено подтверждение', dashboard.metrics.overdueAcknowledgementAlerts],
                ['Просрочено решение', dashboard.metrics.overdueResolutionAlerts],
                ['Исчерпана доставка', dashboard.metrics.exhaustedDeliveries],
                ['Заражено за 24 ч', dashboard.metrics.infected24h],
                ['Ошибки scan за 24 ч', dashboard.metrics.scanFailed24h],
                ['Ожидают webhook', dashboard.metrics.pendingDeliveries],
                ['Audit events за 24 ч', dashboard.metrics.events24h],
              ] as [string, number][]
            ).map(([label, value]) => (
              <Card key={label}>
                <div className="text-2xl font-extrabold text-ink">{value}</div>
                <div className="mt-1 text-sm text-ink-soft">{label}</div>
              </Card>
            ))}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-ink">Открытые alerts</h2>
              <span className="text-xs text-ink-soft">
                Старейший: {formatDate(dashboard.metrics.oldestOpenAlertAt)}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {dashboard.alerts.map((alert) => (
                <SecurityAlertCard
                  key={alert.id}
                  alert={alert}
                  currentUserId={user?.id ?? null}
                  formatDate={formatDate}
                  isOverdue={isOverdue}
                  pendingAction={actionId}
                  deliveryEnabled={dashboard.delivery.enabled}
                  formOpen={openForm?.alertId === alert.id ? { status: openForm.status } : null}
                  formNote={formNote}
                  onFormNoteChange={setFormNote}
                  onStartForm={(status) => startForm(alert, status)}
                  onCancelForm={cancelForm}
                  onSubmitForm={() => void submitForm()}
                  onAssign={(assigneeUserId) => void assign(alert, assigneeUserId)}
                  onRetryDelivery={() => void retryDelivery(alert)}
                />
              ))}
              {dashboard.alerts.length === 0 && <EmptyState title="Открытых alerts нет" />}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold text-ink">Последние audit events</h2>
            {dashboard.recentEvents.length === 0 ? (
              <EmptyState title="Событий нет" />
            ) : (
              <Card padding="none">
                <Table
                  caption="Последние audit events: время, действие и затронутый ресурс"
                  columns={eventColumns}
                  rows={dashboard.recentEvents}
                  rowKey={(event) => event.id}
                />
              </Card>
            )}
          </section>

          <p className="text-right text-xs text-ink-soft">Обновлено: {formatDate(dashboard.generatedAt)}</p>
        </>
      )}
    </div>
  );
}
