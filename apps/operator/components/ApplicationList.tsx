'use client';
import { Badge, EmptyState, SkeletonList } from '@masterqala/ui';
import { MASTER_STATUS_LABELS, type ApplicationListItem, type MasterStatus } from '@/lib/verification';

const STATUS_TONE: Record<MasterStatus, 'neutral' | 'primary' | 'success' | 'danger' | 'warning'> = {
  PENDING_REVIEW: 'primary',
  NEEDS_INFO: 'warning',
  ACTIVE: 'success',
  REJECTED: 'danger',
};

function formatWaiting(createdAt: string): string {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  return hours < 24 ? `ждёт ${hours} ч` : `ждёт ${Math.floor(hours / 24)} дн`;
}

/** Левая колонка раздела «Верификация»: анкеты, поданные мастерами. */
export function ApplicationList({
  items,
  loading,
  selectedId,
  onSelect,
}: {
  items: ApplicationListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (loading) return <SkeletonList rows={4} label="Загрузка анкет" />;
  if (items.length === 0) return <EmptyState title="Пусто" subtitle="Анкет с таким статусом нет." />;

  return (
    <ul className="flex flex-col gap-2">
      {items.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onSelect(a.id)}
            aria-current={selectedId === a.id ? 'true' : undefined}
            className={`w-full rounded-lg border-2 bg-surface p-3 text-left transition-colors duration-(--duration-fast) ease-(--ease-out) ${
              selectedId === a.id ? 'border-primary' : 'border-border hover:border-border-strong'
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-ink">{a.fullName}</span>
              <Badge tone={STATUS_TONE[a.status]}>{MASTER_STATUS_LABELS[a.status]}</Badge>
            </span>
            <span className="mt-1 block text-xs font-semibold text-ink-soft">
              {a.categories.map((c) => c.category.name).join(', ')} · {formatWaiting(a.createdAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
