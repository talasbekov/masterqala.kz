import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
};

interface Row {
  id: string;
  amount: number;
  status: string;
  requestedAt: string;
  master: { phone: string };
}

export default function AdminWithdrawalsPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api('/admin/withdrawals').then(setRows);
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Link to="/admin" className="text-sm text-gray-500">← К заявкам мастеров</Link>
      <h1 className="text-2xl font-bold">Заявки на вывод</h1>
      <ul className="divide-y rounded border">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between p-3">
            <span>···{r.master.phone} · {r.amount} ₸</span>
            <span className="text-sm text-gray-500">
              {STATUS_LABELS[r.status]} · {new Date(r.requestedAt).toLocaleDateString('ru-RU')}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="p-3 text-gray-500">Пусто</li>}
      </ul>
    </div>
  );
}
