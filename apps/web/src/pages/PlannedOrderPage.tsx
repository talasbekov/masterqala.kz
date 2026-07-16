import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import { PLANNED_STATUS_LABELS, isPlannedTerminalStatus } from '../orderStatus';

export default function PlannedOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/planned-orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = (p: any) => {
      if (p.plannedOrderId === id) load();
    };
    socket.on('bid:new', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:new', onUpdate);
      socket.off('planned:status', onUpdate);
    };
  }, [id, load]);

  async function selectBid(bidId: string) {
    try {
      await api(`/planned-orders/${id}/select`, { method: 'POST', body: JSON.stringify({ bidId }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function action(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await api(`/planned-orders/${id}/${path}`, { method: 'POST' });
      load();
    } catch (e: any) {
      setError(e.message);
      load();
    }
  }

  if (error && !order) return <div className="p-6 text-red-600">{error}</div>;
  if (!order) return <div className="p-6 text-gray-500">Загрузка…</div>;

  return (
    <div className="mx-auto max-w-sm p-6 pb-32 space-y-4">
      <h1 className="text-xl font-bold">{order.category?.name}</h1>
      <div className="text-teal-700">{PLANNED_STATUS_LABELS[order.status]}</div>
      <div className="text-sm text-gray-500">{new Date(order.scheduledAt).toLocaleString('ru-RU')}</div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {order.status === 'PUBLISHED' && (
        <div className="space-y-2">
          <h2 className="font-semibold">Ставки ({order.bids.length}/5)</h2>
          {order.bids.length === 0 && <p className="text-gray-500">Пока никто не откликнулся</p>}
          {order.bids.map((b: any) => (
            <div key={b.id} className="rounded-xl border p-4 space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold">{b.price} ₸</span>
                <span className="text-sm text-gray-500">{b.term}</span>
              </div>
              {b.comment && <div className="text-sm text-gray-600">{b.comment}</div>}
              <button className="w-full rounded bg-teal-700 p-2 text-white" onClick={() => selectBid(b.id)}>
                Выбрать
              </button>
            </div>
          ))}
        </div>
      )}

      {['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CLOSED'].includes(order.status) && order.master && (
        <div className="rounded-xl border p-4">
          <div className="font-semibold">{order.master.name ?? 'Мастер'}</div>
          {order.master.phone ? (
            <a href={`tel:${order.master.phone}`} className="text-teal-700 underline">{order.master.phone}</a>
          ) : (
            <div className="text-sm text-gray-500">Ждём подтверждения…</div>
          )}
        </div>
      )}

      {isPlannedTerminalStatus(order.status) && (
        <button className="text-teal-700 underline" onClick={() => navigate('/')}>На главную</button>
      )}

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-sm space-y-2 bg-white p-4">
        {order.status === 'DONE' && (
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('confirm-completion')}>
            Подтвердить выполнение
          </button>
        )}
        {['CREATED', 'PUBLISHED', 'MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'].includes(order.status) && (
          <button
            className="w-full rounded border border-red-300 p-3 text-red-600"
            onClick={() => action('cancel', 'Отменить заявку?')}
          >
            Отменить
          </button>
        )}
      </div>
    </div>
  );
}
