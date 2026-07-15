import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { STATUS_LABELS } from '../orderStatus';

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    api('/orders').then(setOrders);
  }, []);
  return (
    <div className="mx-auto max-w-sm p-6 space-y-3">
      <h1 className="text-2xl font-bold">Мои заявки</h1>
      {orders.length === 0 && <p className="text-gray-500">Заявок пока нет</p>}
      {orders.map((o) => (
        <Link key={o.id} to={`/order/${o.id}`} className="block rounded-xl border p-4">
          <div className="flex justify-between">
            <span className="font-semibold">{o.category?.name}</span>
            <span className="text-sm text-teal-700">{STATUS_LABELS[o.status]}</span>
          </div>
          <div className="text-sm text-gray-500">
            {new Date(o.createdAt).toLocaleString('ru-RU')} · Выезд {o.calloutPrice} ₸
          </div>
        </Link>
      ))}
    </div>
  );
}
