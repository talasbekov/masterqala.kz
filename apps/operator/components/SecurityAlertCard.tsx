'use client';
import { Badge, Button, Textarea } from '@masterqala/ui';
import type { SecurityAlert } from '@/lib/security';

const SEVERITY_CLASS: Record<SecurityAlert['severity'], string> = {
  CRITICAL: 'border-danger bg-danger-soft text-danger-ink',
  HIGH: 'border-warning-ink bg-warning-soft text-warning-ink',
  WARNING: 'border-warning-ink bg-warning-soft text-warning-ink',
};

/** Карточка одного security-alert со всеми действиями оператора. */
export function SecurityAlertCard({
  alert,
  currentUserId,
  formatDate,
  isOverdue,
  pendingAction,
  deliveryEnabled,
  formOpen,
  formNote,
  onFormNoteChange,
  onStartForm,
  onCancelForm,
  onSubmitForm,
  onAssign,
  onRetryDelivery,
}: {
  alert: SecurityAlert;
  currentUserId: string | null;
  formatDate: (value: string | null) => string;
  isOverdue: (value: string | null) => boolean;
  /** `${alert.id}:${action}` выполняемого сейчас действия, либо null. */
  pendingAction: string | null;
  deliveryEnabled: boolean;
  formOpen: { status: 'ACKNOWLEDGED' | 'RESOLVED' } | null;
  formNote: string;
  onFormNoteChange: (value: string) => void;
  onStartForm: (status: 'ACKNOWLEDGED' | 'RESOLVED') => void;
  onCancelForm: () => void;
  onSubmitForm: () => void;
  onAssign: (assigneeUserId: string | null) => void;
  onRetryDelivery: () => void;
}) {
  const actionPending = pendingAction?.startsWith(`${alert.id}:`) ?? false;
  const ackOverdue = alert.status === 'OPEN' && isOverdue(alert.acknowledgeBy);
  const resolveOverdue = alert.status === 'ACKNOWLEDGED' && isOverdue(alert.resolveBy);

  return (
    <article className={`rounded-lg border-2 p-4 ${SEVERITY_CLASS[alert.severity]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{alert.severity}</Badge>
            <Badge tone="neutral">{alert.status}</Badge>
            {alert.escalationLevel > 0 && <Badge tone="danger">ESC L{alert.escalationLevel}</Badge>}
            {alert.occurrenceCount > 1 && (
              <span className="text-2xs font-bold">Повторений: {alert.occurrenceCount}</span>
            )}
          </div>
          <h3 className="mt-2 text-sm font-extrabold">{alert.title}</h3>
          <p className="mt-1 break-all text-xs">
            {alert.resourceType} · {alert.resourceId}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            <span>
              Ответственный:{' '}
              {alert.assignedToUserId === currentUserId ? 'Вы' : (alert.assignedToUserId ?? 'не назначен')}
            </span>
            <span>Последнее событие: {formatDate(alert.lastSeenAt)}</span>
            <span className={ackOverdue ? 'font-extrabold' : ''}>
              Принять до: {formatDate(alert.acknowledgeBy)}
            </span>
            <span className={resolveOverdue ? 'font-extrabold' : ''}>
              Решить до: {formatDate(alert.resolveBy)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {alert.assignedToUserId !== currentUserId && currentUserId && (
            <Button
              variant="secondary"
              size="sm"
              loading={pendingAction === `${alert.id}:assign`}
              disabled={actionPending}
              onClick={() => onAssign(currentUserId)}
            >
              Назначить себе
            </Button>
          )}
          {alert.assignedToUserId === currentUserId && (
            <Button
              variant="secondary"
              size="sm"
              loading={pendingAction === `${alert.id}:assign`}
              disabled={actionPending}
              onClick={() => onAssign(null)}
            >
              Снять
            </Button>
          )}
          {alert.status === 'OPEN' && (
            <Button
              variant="secondary"
              size="sm"
              disabled={actionPending}
              onClick={() => onStartForm('ACKNOWLEDGED')}
            >
              Принять
            </Button>
          )}
          {deliveryEnabled && (
            <Button
              variant="secondary"
              size="sm"
              loading={pendingAction === `${alert.id}:retry`}
              disabled={actionPending}
              onClick={onRetryDelivery}
            >
              Повторить webhook
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={actionPending}
            onClick={() => onStartForm('RESOLVED')}
          >
            Закрыть
          </Button>
        </div>
      </div>

      {formOpen && (
        <div className="mt-3 flex flex-col gap-2 rounded-md bg-surface p-3">
          <Textarea
            label={formOpen.status === 'ACKNOWLEDGED' ? 'Комментарий оператора' : 'Как был устранён инцидент?'}
            hint={formOpen.status === 'ACKNOWLEDGED' ? 'Необязательно.' : undefined}
            rows={2}
            value={formNote}
            onChange={(e) => onFormNoteChange(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={pendingAction === `${alert.id}:${formOpen.status}`}
              disabled={actionPending}
              onClick={onSubmitForm}
            >
              Подтвердить
            </Button>
            <Button variant="secondary" size="sm" onClick={onCancelForm}>
              Отмена
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
