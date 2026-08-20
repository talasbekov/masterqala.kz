'use client';
import { useState } from 'react';
import MapView from './MapView';
import { ActiveOrderViewMobile } from './ActiveOrderViewMobile';
import { useMasterPresence } from '@/lib/masterPresence';
import {
  cancelOrder,
  completeOrder,
  proposePrice,
  setOnSite,
  setOnWay,
  type ActiveOrder,
} from '@/lib/activeOrder';

const FALLBACK_CENTER = { lat: 43.2389, lng: 76.8897 };

export function ActiveOrderView({ order, onChanged }: { order: ActiveOrder; onChanged: () => void }) {
  const { myPosition } = useMasterPresence();
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const center = order.lat != null && order.lng != null ? { lat: order.lat, lng: order.lng } : FALLBACK_CENTER;

  async function run(action: () => Promise<void>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError('');
    setSubmitting(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="hidden h-full md:flex">
        <MapView mode="tracking" center={center} masterPosition={myPosition} height={undefined} className="flex-1 rounded-none" />
        <div className="w-[380px] shrink-0 space-y-4 overflow-y-auto border-l border-border bg-surface p-6">
          <h2 className="text-lg font-extrabold text-ink">{order.category?.name}</h2>
          <div className="space-y-1 rounded-lg border border-border p-4">
            <div className="text-sm text-ink">{order.address}</div>
            <div className="text-sm text-ink-soft">{order.description}</div>
            {order.client?.phone && (
              <a href={`tel:${order.client.phone}`} className="text-sm font-bold text-primary underline">
                {order.client.phone}
              </a>
            )}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}

          {order.status === 'ACCEPTED' && (
            <button
              disabled={submitting}
              className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40"
              onClick={() => run(() => setOnWay(order.id))}
            >
              Еду
            </button>
          )}
          {order.status === 'MASTER_ON_WAY' && (
            <button
              disabled={submitting}
              className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40"
              onClick={() => run(() => setOnSite(order.id))}
            >
              На месте
            </button>
          )}
          {order.status === 'INSPECTION' && (
            <div className="space-y-2">
              <input
                type="number"
                min="1"
                placeholder="Стоимость работ, ₸"
                className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <input
                placeholder="Комментарий (необязательно)"
                className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                disabled={submitting || !Number(price)}
                className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40"
                onClick={() => run(() => proposePrice(order.id, Number(price), comment))}
              >
                Отправить цену
              </button>
            </div>
          )}
          {order.status === 'AWAITING_PRICE_CONFIRM' && (
            <p className="text-center text-sm text-ink-soft">Ожидание подтверждения цены клиентом…</p>
          )}
          {order.status === 'IN_PROGRESS' && (
            <button
              disabled={submitting}
              className="w-full rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40"
              onClick={() => run(() => completeOrder(order.id))}
            >
              Выполнено
            </button>
          )}
          {(order.status === 'ACCEPTED' || order.status === 'MASTER_ON_WAY') && (
            <button
              disabled={submitting}
              className="w-full rounded-pill border-[1.5px] border-danger p-3 text-sm font-extrabold text-danger disabled:opacity-40"
              onClick={() => run(() => cancelOrder(order.id), 'Отменить заявку? Заявка вернётся в поиск, отмены фиксируются.')}
            >
              Отменить
            </button>
          )}
        </div>
      </div>
      <ActiveOrderViewMobile order={order} onChanged={onChanged} />
    </>
  );
}
