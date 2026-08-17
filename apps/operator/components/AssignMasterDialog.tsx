'use client';
import { Alert, Button, EmptyState, SkeletonList } from '@masterqala/ui';
import { Dialog } from './Dialog';
import type { AssignCandidate } from '@/lib/orders';

export function AssignMasterDialog({
  candidates,
  loading,
  error,
  assigning,
  onAssign,
  onClose,
}: {
  candidates: AssignCandidate[] | null;
  loading: boolean;
  error: string;
  assigning: string | null;
  onAssign: (masterUserId: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      title="Выберите мастера"
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
      }
    >
      {loading && <SkeletonList rows={3} label="Загрузка кандидатов" />}
      {error && <Alert tone="danger">{error}</Alert>}
      {!loading && candidates && candidates.length === 0 && (
        <EmptyState
          title="Нет доступных кандидатов"
          subtitle="Сейчас онлайн нет мастеров, подходящих под эту заявку."
        />
      )}
      {!loading && candidates && candidates.length > 0 && (
        <ul className="flex flex-col gap-2">
          {candidates.map((c) => (
            <li
              key={c.masterUserId}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <span className="text-sm font-bold text-ink">
                {c.name} · {c.distanceKm} км · {c.isOnline ? 'онлайн' : 'офлайн'}
              </span>
              <Button
                size="sm"
                loading={assigning === c.masterUserId}
                disabled={assigning !== null}
                onClick={() => onAssign(c.masterUserId)}
              >
                Назначить
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
