'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Card, ClockIcon } from '@masterqala/ui';
import { api } from '@/lib/api';
import type { OrderDetail } from '@/lib/orderTypes';

export default function PriceView({ order, orderId, onChanged }: { order: OrderDetail; orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const paymentsEnabled = order.commercialMode !== 'FREE_PILOT' && order.freePilot !== true;
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order.priceDeadline) return;
    const deadline = new Date(order.priceDeadline).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.priceDeadline]);

  async function confirm() {
    setError('');
    try {
      await api(`/orders/${orderId}/confirm-price`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function reject() {
    setError('');
    try {
      await api(`/orders/${orderId}/reject-price`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const total = order.calloutPrice + (order.workPrice ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-extrabold text-ink">{t('orderDetail.priceTitle')}</h1>
        {/* Таймер срочного режима: оранжевый = срочность. */}
        <Badge tone="urgent" icon={<ClockIcon size={14} />}>
          {mm}:{String(ss).padStart(2, '0')}
        </Badge>
      </div>
      <p className="text-sm font-semibold text-ink">{t('orderDetail.priceOffered', { name: order.master?.name })}</p>
      <Card>
        {paymentsEnabled && (
          <div className="flex justify-between text-xs font-semibold text-ink-soft">
            <span>{t('orderDetail.priceCalloutLabel')}</span>
            <span>{order.calloutPrice} ₸</span>
          </div>
        )}
        <div className={`${paymentsEnabled ? 'mt-1.5' : ''} flex justify-between text-sm font-extrabold text-ink`}>
          <span>{t('orderDetail.priceWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-border" />
        <div className="flex justify-between text-lg font-extrabold text-ink">
          <span>{t('orderDetail.priceTotalLabel')}</span>
          <span className="text-primary">{total} ₸</span>
        </div>
      </Card>
      {order.workComment && (
        <p className="rounded-md bg-surface-sunken p-3 text-xs leading-relaxed text-on-fill">«{order.workComment}»</p>
      )}
      <p className="text-xs leading-relaxed text-ink-soft">
        {paymentsEnabled
          ? t('orderDetail.priceRejectNote')
          : 'В бесплатном пилоте платформа не списывает деньги. После подтверждения вы рассчитываетесь с мастером напрямую; при отклонении заявка отменится.'}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <Button size="lg" fullWidth onClick={confirm}>
        {t('orderDetail.priceConfirm', { price: order.workPrice })}
      </Button>
      <Button variant="secondary" fullWidth onClick={reject}>
        {t('orderDetail.priceReject')}
      </Button>
    </div>
  );
}
