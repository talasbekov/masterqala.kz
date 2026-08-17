'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Alert, Button, SkeletonList } from '@masterqala/ui';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { PlannedOrderDetail } from '@/lib/plannedOrderTypes';
import PwaitView from '@/components/planned-order-views/PwaitView';
import PactiveView from '@/components/planned-order-views/PactiveView';
import PlannedDoneView from '@/components/planned-order-views/PlannedDoneView';
import PlannedClosedView from '@/components/planned-order-views/PlannedClosedView';

const ACTIVE_STATUSES = ['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'];

export default function PlannedOrderPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PlannedOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    return api(`/planned-orders/${id}`)
      .then(setOrder)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = (p: { plannedOrderId: string }) => {
      if (p.plannedOrderId === id) load();
    };
    socket.on('bid:new', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:new', onUpdate);
      socket.off('planned:status', onUpdate);
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

  if (order.status === 'PUBLISHED') return <PwaitView order={order} orderId={id} onChanged={load} />;
  if (ACTIVE_STATUSES.includes(order.status)) return <PactiveView order={order} orderId={id} onChanged={load} />;
  if (order.status === 'DONE') return <PlannedDoneView order={order} orderId={id} onChanged={load} />;
  return <PlannedClosedView order={order} onChanged={load} />;
}
