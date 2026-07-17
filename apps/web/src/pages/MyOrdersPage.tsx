import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { STATUS_LABELS, PLANNED_STATUS_LABELS, urgentStatusVariant, plannedStatusVariant } from '../orderStatus';
import { StatusPill, EmptyState, ListIcon } from '@masterqala/ui';

export default function MyOrdersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api('/orders'), api('/planned-orders/mine')])
      .then(([urgent, planned]) => {
        const merged = [
          ...urgent.map((o: any) => ({ ...o, kind: 'urgent' as const })),
          ...planned.map((o: any) => ({ ...o, kind: 'planned' as const })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(merged);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-sm space-y-3 p-6">
      <h1 className="text-xl font-extrabold text-foreground">Мои заявки</h1>
      {!loading && items.length === 0 && (
        <EmptyState
          icon={<ListIcon className="h-8 w-8" />}
          title="Заявок пока нет"
          subtitle="Здесь появится история ваших вызовов"
        />
      )}
      {items.map((o) => (
        <Link
          key={o.id}
          to={o.kind === 'urgent' ? `/order/${o.id}` : `/planned/${o.id}`}
          className="block rounded-lg bg-surface p-4 shadow-card"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-foreground">{o.category?.name}</span>
            <StatusPill variant={o.kind === 'urgent' ? urgentStatusVariant(o.status) : plannedStatusVariant(o.status)}>
              {o.kind === 'urgent' ? STATUS_LABELS[o.status] : PLANNED_STATUS_LABELS[o.status]}
            </StatusPill>
          </div>
          <div className="mt-1 text-sm text-muted">
            {new Date(o.createdAt).toLocaleString('ru-RU')} · {o.kind === 'urgent' ? 'Срочная' : 'Плановая'}
          </div>
        </Link>
      ))}
    </div>
  );
}
