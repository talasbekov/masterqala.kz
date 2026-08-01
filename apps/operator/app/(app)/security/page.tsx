'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  fetchSecurityDashboard,
  transitionAlert,
  assignAlert,
  retryAlertDelivery,
  type SecurityDashboard,
  type SecurityAlert,
  type Dependency,
} from '@/lib/security';

const SEVERITY_CLASS: Record<SecurityAlert['severity'], string> = {
  CRITICAL: 'border-danger bg-danger-bg text-danger-ink',
  HIGH: 'border-warning-ink bg-warning-bg text-warning-ink',
  WARNING: 'border-warning-ink bg-warning-bg text-warning-ink',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}

function isOverdue(value: string | null): boolean {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

function DependencyCard({ title, dependency }: { title: string; dependency: Dependency }) {
  const healthy = dependency.status === 'UP' || dependency.status === 'DISABLED';
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-extrabold text-ink">{title}</span>
        <span
          className={`rounded-pill px-2 py-1 text-[10px] font-extrabold ${
            healthy ? 'bg-success-bg text-success-ink' : 'bg-danger-bg text-danger'
          }`}
        >
          {dependency.status}
        </span>
      </div>
      <div className="mt-2 text-xs text-ink-soft">
        {dependency.latencyMs !== undefined && <span>{dependency.latencyMs} мс</span>}
        {dependency.mode && <span> · {dependency.mode}</span>}
      </div>
      {dependency.lastError && <p className="mt-2 break-words text-xs text-danger">{dependency.lastError}</p>}
    </div>
  );
}

export default function SecurityPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <div className="p-8 text-sm text-ink-soft">Загрузка security dashboard…</div>;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-extrabold text-ink">Безопасность платформы</div>
          <p className="text-sm text-ink-soft">Инфраструктура, SLA инцидентов, внешняя доставка и audit trail.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border-[1.5px] border-border bg-surface px-4 py-2 text-sm font-extrabold text-ink"
        >
          Обновить
        </button>
      </div>

      {error && <div className="rounded-md bg-danger-bg p-3 text-sm text-danger">{error}</div>}

      {dashboard && (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="text-lg font-extrabold text-ink">Готовность</div>
              <span
                className={`rounded-pill px-3 py-1 text-xs font-extrabold ${
                  dashboard.readiness.status === 'ready' ? 'bg-success-bg text-success-ink' : 'bg-danger-bg text-danger'
                }`}
              >
                {dashboard.readiness.status === 'ready' ? 'READY' : 'NOT READY'}
              </span>
              <span className="text-xs text-ink-soft">{dashboard.readiness.environment}</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <DependencyCard title="PostgreSQL" dependency={dashboard.readiness.dependencies.database} />
              <DependencyCard title="pg-boss" dependency={dashboard.readiness.dependencies.queue} />
              <DependencyCard title="ClamAV" dependency={dashboard.readiness.dependencies.scanner} />
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-extrabold text-ink">Alert webhook</span>
                  <span
                    className={`rounded-pill px-2 py-1 text-[10px] font-extrabold ${
                      dashboard.delivery.enabled ? 'bg-success-bg text-success-ink' : 'bg-fill-soft text-ink-soft'
                    }`}
                  >
                    {dashboard.delivery.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                  {dashboard.delivery.timeoutMs} мс · {dashboard.delivery.maxAttempts} попыток
                </p>
              </div>
            </div>
            {dashboard.readiness.warnings.length > 0 && (
              <ul className="rounded-md bg-warning-bg p-3 text-sm text-warning-ink">
                {dashboard.readiness.warnings.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid grid-cols-4 gap-3">
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
              <div key={label as string} className="rounded-lg border border-border bg-surface p-4">
                <div className="text-2xl font-extrabold text-ink">{value}</div>
                <div className="mt-1 text-sm text-ink-soft">{label}</div>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold text-ink">Открытые alerts</div>
              <span className="text-xs text-ink-soft">Старейший: {formatDate(dashboard.metrics.oldestOpenAlertAt)}</span>
            </div>
            <div className="flex flex-col gap-3">
              {dashboard.alerts.map((alert) => {
                const actionPending = actionId?.startsWith(`${alert.id}:`) ?? false;
                const ackOverdue = alert.status === 'OPEN' && isOverdue(alert.acknowledgeBy);
                const resolveOverdue = alert.status === 'ACKNOWLEDGED' && isOverdue(alert.resolveBy);
                const formOpenHere = openForm?.alertId === alert.id;
                return (
                  <article key={alert.id} className={`rounded-lg border-2 p-4 ${SEVERITY_CLASS[alert.severity]}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-pill bg-surface/70 px-2 py-1 text-[10px] font-extrabold">
                            {alert.severity}
                          </span>
                          <span className="rounded-pill bg-surface/70 px-2 py-1 text-[10px] font-bold">{alert.status}</span>
                          {alert.escalationLevel > 0 && (
                            <span className="rounded-pill bg-danger px-2 py-1 text-[10px] font-extrabold text-white">
                              ESC L{alert.escalationLevel}
                            </span>
                          )}
                          {alert.occurrenceCount > 1 && (
                            <span className="text-[10px] font-bold">Повторений: {alert.occurrenceCount}</span>
                          )}
                        </div>
                        <h3 className="mt-2 text-sm font-extrabold">{alert.title}</h3>
                        <p className="mt-1 break-all text-xs opacity-80">
                          {alert.resourceType} · {alert.resourceId}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-1 text-xs opacity-90">
                          <span>Ответственный: {alert.assignedToUserId === user?.id ? 'Вы' : alert.assignedToUserId ?? 'не назначен'}</span>
                          <span>Последнее событие: {formatDate(alert.lastSeenAt)}</span>
                          <span className={ackOverdue ? 'font-extrabold' : ''}>Принять до: {formatDate(alert.acknowledgeBy)}</span>
                          <span className={resolveOverdue ? 'font-extrabold' : ''}>Решить до: {formatDate(alert.resolveBy)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {alert.assignedToUserId !== user?.id && user && (
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void assign(alert, user.id)}
                            className="rounded-md border border-current bg-surface/70 px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                          >
                            Назначить себе
                          </button>
                        )}
                        {alert.assignedToUserId === user?.id && (
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void assign(alert, null)}
                            className="rounded-md border border-current bg-surface/70 px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                          >
                            Снять
                          </button>
                        )}
                        {alert.status === 'OPEN' && (
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => startForm(alert, 'ACKNOWLEDGED')}
                            className="rounded-md border border-current bg-surface/70 px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                          >
                            Принять
                          </button>
                        )}
                        {dashboard.delivery.enabled && (
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void retryDelivery(alert)}
                            className="rounded-md border border-current bg-surface/70 px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                          >
                            Повторить webhook
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={actionPending}
                          onClick={() => startForm(alert, 'RESOLVED')}
                          className="rounded-md border border-current bg-surface/70 px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                        >
                          Закрыть
                        </button>
                      </div>
                    </div>

                    {formOpenHere && (
                      <div className="mt-3 flex flex-col gap-2 rounded-md bg-surface/70 p-3">
                        <textarea
                          value={formNote}
                          onChange={(e) => setFormNote(e.target.value)}
                          placeholder={
                            openForm.status === 'ACKNOWLEDGED' ? 'Комментарий оператора (необязательно)' : 'Как был устранён инцидент?'
                          }
                          className="min-h-14 rounded-md border-[1.5px] border-current bg-surface p-2 text-sm text-ink"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actionPending}
                            onClick={() => void submitForm()}
                            className="rounded-pill bg-primary px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-40"
                          >
                            Подтвердить
                          </button>
                          <button
                            type="button"
                            onClick={cancelForm}
                            className="rounded-pill border-[1.5px] border-current px-3 py-1.5 text-xs font-extrabold"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {dashboard.alerts.length === 0 && (
                <div className="rounded-lg border border-border p-6 text-center text-sm text-ink-soft">
                  Открытых alerts нет
                </div>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="text-lg font-extrabold text-ink">Последние audit events</div>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <div className="grid grid-cols-[130px_1fr_150px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
                <span>Время</span>
                <span>Событие</span>
                <span>Ресурс</span>
              </div>
              {dashboard.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-[130px_1fr_150px] items-start gap-3 border-b border-fill-soft px-4 py-2.5 text-sm"
                >
                  <span className="text-ink-soft">{formatDate(event.createdAt)}</span>
                  <span className="font-bold text-ink">
                    {event.action} <span className="text-ink-soft">· {event.severity} · {event.outcome}</span>
                  </span>
                  <span className="truncate text-xs text-ink-soft">
                    {event.resourceType} · {event.resourceId}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <p className="text-right text-xs text-ink-soft">Обновлено: {formatDate(dashboard.generatedAt)}</p>
        </>
      )}
    </div>
  );
}
