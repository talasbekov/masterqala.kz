'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button } from '@masterqala/ui';
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
    // Ниже lg карта и панель складываются в колонку: панель в 380px рядом с
    // картой не помещалась на узком экране.
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
      <MapView
        mode="pulse"
        center={{ lat: 0, lng: 0 }}
        height={undefined}
        className="h-56 rounded-none lg:h-auto lg:flex-1"
      />
      <div className="overflow-y-auto border-border bg-surface px-5 py-5 lg:w-[380px] lg:shrink-0 lg:border-l">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-extrabold text-ink">{WAVE_TEXTS[order.wave] ?? WAVE_TEXTS[0]}</p>
          {/* Таймер срочного режима — оранжевый здесь значит «срочно». */}
          <p className="text-sm font-extrabold text-urgent" aria-live="off">
            {mm}:{String(ss).padStart(2, '0')}
          </p>
        </div>
        {error && (
          <Alert tone="danger" className="mt-2">
            {error}
          </Alert>
        )}
        <Button variant="secondary" fullWidth className="mt-3" onClick={cancel}>
          {t('orderDetail.cancelFree')}
        </Button>
      </div>
    </div>
  );
}
