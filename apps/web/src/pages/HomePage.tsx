import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import { STATUS_LABELS } from '../orderStatus';

export default function HomePage() {
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api('/orders/active')
      .then((r) => setOrder(r.order))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const socket = getSocket();
    const onStatus = () => load();
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:status', onStatus);
    };
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Загрузка…</div>;

  return (
    <div className="mx-auto max-w-sm p-6 space-y-6">
      <h1 className="text-2xl font-bold">MasterQala</h1>
      {order ? (
        <Link to={`/order/${order.id}`} className="block rounded-xl border p-4 shadow-sm">
          <div className="font-semibold">{order.category?.name}</div>
          <div className="text-teal-700">{STATUS_LABELS[order.status]}</div>
          <div className="text-sm text-gray-500">{order.address}</div>
        </Link>
      ) : (
        <Link to="/order/new" className="block rounded-xl bg-teal-700 p-6 text-center text-xl font-semibold text-white">
          Вызвать мастера
        </Link>
      )}
    </div>
  );
}
