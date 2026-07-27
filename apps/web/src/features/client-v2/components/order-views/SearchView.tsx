import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { WAVE_TEXTS } from '../../../../orderStatus';
import MapView from '../MapView';
import PhotoStrip from '../PhotoStrip';
import type { OrderDetail } from '../../pages/OrderPage';

export default function SearchView({
  order,
  onChanged,
  photoUrls,
}: {
  order: OrderDetail;
  onChanged: () => void;
  photoUrls: string[];
}) {
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
    <div className="flex flex-col">
      <MapView mode="pulse" center={{ lat: 0, lng: 0 }} height={undefined} className="flex-1 rounded-none" />
      <div className="rounded-t-sheet bg-surface px-5 pb-4.5 pt-4 shadow-sheet">
        <div className="mx-auto mb-3 h-1 w-9.5 rounded-full bg-border" />
        <div className="flex items-baseline justify-between">
          <div className="text-lg font-extrabold text-ink">{WAVE_TEXTS[order.wave] ?? WAVE_TEXTS[0]}</div>
          <div className="text-sm font-extrabold text-primary">
            {mm}:{String(ss).padStart(2, '0')}
          </div>
        </div>
        {photoUrls.length > 0 && (
          <div className="mt-3">
            <PhotoStrip urls={photoUrls} />
          </div>
        )}
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
