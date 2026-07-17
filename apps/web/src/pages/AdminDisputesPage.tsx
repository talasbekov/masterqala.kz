import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const STATUS_LABELS: Record<string, string> = { OPEN: 'Открыт', RESOLVED: 'Разрешён' };

interface Row {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  openedByRole: string;
  status: string;
  createdAt: string;
}

export default function AdminDisputesPage() {
  const [status, setStatus] = useState('OPEN');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api(`/admin/disputes?status=${status}`).then(setRows);
  }, [status]);

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Link to="/admin" className="text-sm text-gray-500">← К заявкам мастеров</Link>
      <h1 className="text-2xl font-bold">Споры</h1>
      <select className="rounded border p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="OPEN">Открытые</option>
        <option value="RESOLVED">Разрешённые</option>
      </select>
      <ul className="divide-y rounded border">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/admin/disputes/${r.id}`} className="block p-3 hover:bg-gray-50">
              <span className="font-semibold">{r.orderId ? 'Срочная' : 'Плановая'}</span> ·{' '}
              открыл {r.openedByRole === 'CLIENT' ? 'клиент' : 'мастер'} ·{' '}
              <span className="text-sm text-gray-500">{STATUS_LABELS[r.status]} · {new Date(r.createdAt).toLocaleDateString('ru-RU')}</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-3 text-gray-500">Пусто</li>}
      </ul>
    </div>
  );
}
