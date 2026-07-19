import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { WAVE_TEXTS } from '../../../../orderStatus';
import MapView from '../MapView';
import type { OrderDetail } from '../../pages/OrderPage';

export default function SearchView({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(order.createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  async function cancel() {
    await api(`/orders/${order.id}/cancel`, { method: 'POST' });
    onChanged();
  }

  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;

  return (
    <div className="flex flex-col">
      <MapView mode="pulse" center={{ lat: 0, lng: 0 }} height={undefined} className="flex-1 rounded-none" />
      <div className="rounded-t-c2-sheet bg-c2-surface px-5 pb-4.5 pt-4 shadow-c2-sheet">
        <div className="mx-auto mb-3 h-1 w-9.5 rounded-full bg-c2-border" />
        <div className="flex items-baseline justify-between">
          <div className="text-lg font-extrabold text-c2-ink">{WAVE_TEXTS[order.wave] ?? WAVE_TEXTS[0]}</div>
          <div className="text-sm font-extrabold text-c2-primary">
            {mm}:{String(ss).padStart(2, '0')}
          </div>
        </div>
        <button
          type="button"
          onClick={cancel}
          className="mt-3 w-full rounded-c2-pill border-[1.5px] border-c2-danger p-3.5 text-sm font-extrabold text-c2-danger"
        >
          {t('orderDetail.cancelFree')}
        </button>
      </div>
    </div>
  );
}
