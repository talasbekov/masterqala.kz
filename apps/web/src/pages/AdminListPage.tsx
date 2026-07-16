import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

interface Row {
  id: string;
  fullName: string;
  district: string;
  status: string;
  createdAt: string;
  user: { phone: string };
  categories: { category: { name: string } }[];
}

const STATUSES = [
  { value: 'PENDING_REVIEW', label: 'На проверке' },
  { value: 'NEEDS_INFO', label: 'Нужны данные' },
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'REJECTED', label: 'Отклонённые' },
];

export default function AdminListPage() {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api(`/admin/applications?status=${status}`).then(setRows);
  }, [status]);

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Link to="/" className="text-sm text-gray-500">← Назад</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Заявки мастеров</h1>
        <Link to="/admin/withdrawals" className="text-sm text-teal-700 underline">Заявки на вывод</Link>
      </div>
      <select className="rounded border p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <ul className="divide-y rounded border">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`/admin/${r.id}`} className="block p-3 hover:bg-gray-50">
              <span className="font-semibold">{r.fullName}</span> · {r.user.phone} · {r.district} ·{' '}
              {r.categories.map((c) => c.category.name).join(', ')}
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-3 text-gray-500">Пусто</li>}
      </ul>
    </div>
  );
}
