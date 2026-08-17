import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, CheckIcon, PhoneIcon, StarIcon } from '@masterqala/ui';
import { api } from '../../../../api';
import { getSocket } from '../../../../socket';
import { STATUS_LABELS } from '../../../../orderStatus';
import MapView, { type LatLng } from '../MapView';
import type { OrderDetail } from '../../pages/OrderPage';

export default function TrackView({ order, orderId }: { order: OrderDetail; orderId: string }) {
  const { t } = useTranslation();
  const [masterPos, setMasterPos] = useState<LatLng | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [error, setError] = useState('');

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
    setError('');
    try {
      await api(`/orders/${orderId}/cancel`, { method: 'POST' });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col">
      <MapView mode="tracking" center={masterPos ?? { lat: 51.1605, lng: 71.4704 }} masterPosition={masterPos} height={undefined} className="flex-1 rounded-none" />
      <div className="rounded-t-sheet bg-surface px-5 pb-4 pt-3.5 shadow-sheet">
        <div className="mx-auto mb-2.5 h-1 w-9.5 rounded-full bg-border" />
        <div className="flex items-center gap-3">
          <div className="flex h-11.5 w-11.5 shrink-0 items-center justify-center rounded-full bg-fill text-sm font-extrabold text-ink">
            {order.master?.name?.slice(0, 2).toUpperCase() ?? '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
              <span className="truncate">{order.master?.name}</span>
              <Badge tone="success" icon={<CheckIcon size={14} />}>
                {t('orderDetail.verified')}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
              <StarIcon size={14} className="shrink-0 text-warning" />
              {order.master?.rating?.toFixed(1) ?? '—'} · {t('orderDetail.ordersCount', { n: order.master?.reviewCount ?? 0 })} ·{' '}
              {STATUS_LABELS[order.status]}
            </div>
          </div>
          {order.master?.phone && (
            /* Остаётся ссылкой tel:, а не IconButton: набор номера — задача
               браузера/ОС. Размер и вид совпадают с IconButton variant="primary". */
            <a
              href={`tel:${order.master.phone}`}
              aria-label={t('orderDetail.callMaster')}
              title={t('orderDetail.callMaster')}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary"
            >
              <PhoneIcon size={20} />
            </a>
          )}
        </div>
        {eta != null && (
          <div className="mt-2.5 flex items-center justify-between rounded-md bg-fill px-3.5 py-2.5">
            <span className="text-xs font-bold text-ink">{t('orderDetail.etaLabel')}</span>
            <span className="text-base font-extrabold text-primary">{t('orderDetail.etaMinutes', { n: eta })}</span>
          </div>
        )}
        {error && (
          <Alert tone="danger" className="mt-2">
            {error}
          </Alert>
        )}
        <div className="mt-2.5 flex items-center gap-3.5 text-xs font-extrabold text-primary">
          <Link to="/support">{t('orderDetail.support')}</Link>
          <span className="text-border" aria-hidden="true">
            ·
          </span>
          <span className="text-ink-soft">{t('orderDetail.cancellationRules')}</span>
          <Button variant="danger" onClick={cancel} className="ml-auto">
            {t('orderDetail.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
