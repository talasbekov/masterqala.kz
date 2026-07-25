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
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link to="/" className="text-sm text-gray-500">← Назад</Link>
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Заявки мастеров</h1>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link to="/admin/withdrawals" className="text-teal-700 underline">Заявки на вывод</Link>
          <Link to="/admin/disputes" className="text-teal-700 underline">Споры</Link>
          <Link to="/admin/security" className="font-medium text-red-700 underline">Безопасность</Link>
        </nav>
      </div>
      <select className="rounded border p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <ul className="divide-y rounded border">
        {rows.map((row) => (
          <li key={row.id}>
            <Link to={`/admin/${row.id}`} className="block p-3 hover:bg-gray-50">
              <span className="font-semibold">{row.fullName}</span> · {row.user.phone} · {row.district} ·{' '}
              {row.categories.map((category) => category.category.name).join(', ')}
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-3 text-gray-500">Пусто</li>}
      </ul>
    </div>
  );
}
