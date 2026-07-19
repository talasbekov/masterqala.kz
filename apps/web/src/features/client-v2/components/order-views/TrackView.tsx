import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { getSocket } from '../../../../socket';
import { STATUS_LABELS } from '../../../../orderStatus';
import MapView, { type LatLng } from '../MapView';
import type { OrderDetail } from '../../pages/OrderPage';

export default function TrackView({ order, orderId }: { order: OrderDetail; orderId: string }) {
  const { t } = useTranslation();
  const [masterPos, setMasterPos] = useState<LatLng | null>(null);
  const [eta, setEta] = useState<number | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onLocation = (p: { orderId: string; lat: number; lng: number; etaMinutes: number }) => {
      if (p.orderId !== orderId) return;
      setMasterPos({ lat: p.lat, lng: p.lng });
      setEta(p.etaMinutes);
    };
    socket.on('master:location', onLocation);
    return () => {
      socket.off('master:location', onLocation);
    };
  }, [orderId]);

  async function cancel() {
    if (!confirm(t('orderDetail.cancel') + '?')) return;
    await api(`/orders/${orderId}/cancel`, { method: 'POST' });
  }

  return (
    <div className="flex flex-col">
      <MapView mode="tracking" center={masterPos ?? { lat: 51.1605, lng: 71.4704 }} masterPosition={masterPos} height={undefined} className="flex-1 rounded-none" />
      <div className="rounded-t-c2-sheet bg-c2-surface px-5 pb-4 pt-3.5 shadow-c2-sheet">
        <div className="mx-auto mb-2.5 h-1 w-9.5 rounded-full bg-c2-border" />
        <div className="flex items-center gap-3">
          <div className="flex h-11.5 w-11.5 shrink-0 items-center justify-center rounded-full bg-c2-fill text-[15px] font-extrabold text-c2-ink">
            {order.master?.name?.slice(0, 2).toUpperCase() ?? '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold text-c2-ink">
              {order.master?.name}{' '}
              <span className="rounded-c2-pill bg-c2-success-bg px-2 py-0.5 align-middle text-[10.5px] font-extrabold text-c2-success-ink">
                {t('orderDetail.verified')}
              </span>
            </div>
            <div className="text-xs font-semibold text-c2-ink-soft">
              ★ {order.master?.rating?.toFixed(1) ?? '—'} · {order.master?.reviewCount ?? 0} заказов · {STATUS_LABELS[order.status]}
            </div>
          </div>
          {order.master?.phone && (
            <a
              href={`tel:${order.master.phone}`}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-c2-primary text-lg text-white"
            >
              📞
            </a>
          )}
        </div>
        {eta != null && (
          <div className="mt-2.5 flex items-center justify-between rounded-c2-md bg-c2-fill px-3.5 py-2.5">
            <span className="text-[13px] font-bold text-c2-ink">{t('orderDetail.etaLabel')}</span>
            <span className="text-base font-extrabold text-c2-primary">{eta} мин</span>
          </div>
        )}
        <div className="mt-2.5 flex items-center gap-3.5 text-xs font-extrabold text-c2-primary">
          <Link to="/support">{t('orderDetail.support')}</Link>
          <span className="text-c2-border">·</span>
          <span className="text-c2-ink-soft">{t('orderDetail.cancellationRules')}</span>
          <button type="button" onClick={cancel} className="ml-auto text-c2-danger">
            {t('orderDetail.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
