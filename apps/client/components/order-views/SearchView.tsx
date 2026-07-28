'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { WAVE_TEXTS } from '@/lib/orderStatus';
import MapView from '@/components/MapView';
import type { OrderDetail } from '@/lib/orderTypes';

export default function SearchView({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const start = new Date(order.createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  async function cancel() {
    setError('');
    try {
      await api(`/orders/${order.id}/cancel`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <div className="flex h-screen">
      <MapView mode="pulse" center={{ lat: 0, lng: 0 }} height={undefined} className="flex-1 rounded-none" />
      <div className="w-[380px] shrink-0 overflow-y-auto border-l border-border bg-surface px-5 py-5">
        <div className="flex items-baseline justify-between">
          <div className="text-lg font-extrabold text-ink">{WAVE_TEXTS[order.wave] ?? WAVE_TEXTS[0]}</div>
          <div className="text-sm font-extrabold text-primary">
            {mm}:{String(ss).padStart(2, '0')}
          </div>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
        <button
          type="button"
          onClick={cancel}
          className="mt-3 w-full rounded-pill border-[1.5px] border-danger p-3.5 text-sm font-extrabold text-danger"
        >
          {t('orderDetail.cancelFree')}
        </button>
      </div>
    </div>
  );
}
