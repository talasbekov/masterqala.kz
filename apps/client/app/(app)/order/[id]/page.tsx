'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Alert, Button, SkeletonList } from '@masterqala/ui';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { OrderDetail } from '@/lib/orderTypes';
import SearchView from '@/components/order-views/SearchView';
import NoMastersView from '@/components/order-views/NoMastersView';
import PriceView from '@/components/order-views/PriceView';
import ProgressView from '@/components/order-views/ProgressView';
import DoneView from '@/components/order-views/DoneView';
import ClosedView from '@/components/order-views/ClosedView';
import TrackView from '@/components/order-views/TrackView';

const TRACK_STATUSES = ['ACCEPTED', 'MASTER_ON_WAY', 'INSPECTION'];

export default function OrderPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    return api(`/orders/${id}`)
      .then(setOrder)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    const onStatus = (p: { orderId: string }) => {
      if (p.orderId === id) load();
    };
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:status', onStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading)
    return (
      <div className="p-6">
        <SkeletonList rows={3} label={t('common.loading')} />
      </div>
    );

  if (error || !order || !id) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <Alert tone="danger">{error || t('orderDetail.notFound')}</Alert>
        <Button variant="secondary" onClick={load}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const freePilot = order.commercialMode === 'FREE_PILOT' || order.freePilot === true;

  if (order.status === 'SEARCHING') return <SearchView order={order} onChanged={load} />;
  if (order.status === 'NO_MASTERS') return <NoMastersView orderId={id} freePilot={freePilot} onChanged={load} />;
  if (TRACK_STATUSES.includes(order.status)) return <TrackView order={order} orderId={id} />;
  if (order.status === 'AWAITING_PRICE_CONFIRM') return <PriceView order={order} orderId={id} onChanged={load} />;
  if (order.status === 'IN_PROGRESS') return <ProgressView order={order} />;
  if (order.status === 'DONE') return <DoneView order={order} orderId={id} onChanged={load} />;
  return <ClosedView order={order} onChanged={load} />;
}
