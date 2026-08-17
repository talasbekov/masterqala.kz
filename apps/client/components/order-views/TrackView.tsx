'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, CheckIcon, PhoneIcon, StarIcon } from '@masterqala/ui';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { STATUS_LABELS } from '@/lib/orderStatus';
import MapView, { type LatLng } from '@/components/MapView';
import type { OrderDetail } from '@/lib/orderTypes';

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
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
      <MapView
        mode="tracking"
        center={
          masterPos ?? (order.lat != null && order.lng != null ? { lat: order.lat, lng: order.lng } : { lat: 51.1605, lng: 71.4704 })
        }
        masterPosition={masterPos}
        height={undefined}
        className="h-56 rounded-none lg:h-auto lg:flex-1"
      />
      <div className="overflow-y-auto border-border bg-surface px-5 py-5 lg:w-[380px] lg:shrink-0 lg:border-l">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-sm font-extrabold text-ink">
            {order.master?.name?.slice(0, 2).toUpperCase() ?? '—'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-ink">
              {order.master?.name}
              <Badge tone="success" icon={<CheckIcon size={14} />}>
                {t('orderDetail.verified')}
              </Badge>
            </p>
            <p className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
              <StarIcon size={14} filled className="text-warning" />
              {order.master?.rating?.toFixed(1) ?? '—'} ·{' '}
              {t('orderDetail.ordersCount', { n: order.master?.reviewCount ?? 0 })} · {STATUS_LABELS[order.status]}
            </p>
          </div>
          {order.master?.phone && (
            <a
              href={`tel:${order.master.phone}`}
              aria-label={t('orderDetail.callMaster')}
              title={t('orderDetail.callMaster')}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-primary-hover"
            >
              <PhoneIcon size={20} />
            </a>
          )}
        </div>
        {eta != null && (
          <div className="mt-2.5 flex items-center justify-between rounded-md bg-surface-sunken px-3.5 py-2.5">
            <span className="text-xs font-bold text-ink">{t('orderDetail.etaLabel')}</span>
            <span className="text-base font-extrabold text-primary">{t('orderDetail.etaMinutes', { n: eta })}</span>
          </div>
        )}
        {error && (
          <Alert tone="danger" className="mt-2">
            {error}
          </Alert>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-xs font-extrabold">
          <Link href="/support" className="text-primary">
            {t('orderDetail.support')}
          </Link>
          <span className="text-border" aria-hidden="true">
            ·
          </span>
          <span className="text-ink-soft">{t('orderDetail.cancellationRules')}</span>
          <Button variant="danger" size="sm" className="ml-auto" onClick={cancel}>
            {t('orderDetail.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
