import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { STATUS_LABELS, PLANNED_STATUS_LABELS } from '../orderStatus';

export default function MyOrdersPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api('/orders'), api('/planned-orders/mine')]).then(([urgent, planned]) => {
      const merged = [
        ...urgent.map((o: any) => ({ ...o, kind: 'urgent' as const })),
        ...planned.map((o: any) => ({ ...o, kind: 'planned' as const })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(merged);
    });
  }, []);

  return (
    <div className="mx-auto max-w-sm p-6 space-y-3">
      <h1 className="text-2xl font-bold">Мои заявки</h1>
      {items.length === 0 && <p className="text-gray-500">Заявок пока нет</p>}
      {items.map((o) => (
        <Link
          key={o.id}
          to={o.kind === 'urgent' ? `/order/${o.id}` : `/planned/${o.id}`}
          className="block rounded-xl border p-4"
        >
          <div className="flex justify-between">
            <span className="font-semibold">{o.category?.name}</span>
            <span className="text-sm text-teal-700">
              {o.kind === 'urgent' ? STATUS_LABELS[o.status] : PLANNED_STATUS_LABELS[o.status]}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {new Date(o.createdAt).toLocaleString('ru-RU')} · {o.kind === 'urgent' ? 'Сейчас' : 'Запланировать'}
          </div>
        </Link>
      ))}
    </div>
  );
}
