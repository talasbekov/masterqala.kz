import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Card, ClockIcon } from '@masterqala/ui';
import { api } from '../../../../api';
import type { OrderDetail } from '../../pages/OrderPage';

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
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center justify-between">
        <span className="text-lg font-extrabold text-ink">{t('orderDetail.priceTitle')}</span>
        <Badge tone="primary" icon={<ClockIcon size={14} />}>
          {mm}:{String(ss).padStart(2, '0')}
        </Badge>
      </div>
      <div className="text-sm font-semibold text-ink">{t('orderDetail.priceOffered', { name: order.master?.name })}</div>
      <Card padding="sm">
        {paymentsEnabled && (
          <div className="flex justify-between text-sm font-semibold text-ink-soft">
            <span>{t('orderDetail.priceCalloutLabel')}</span>
            <span>{order.calloutPrice} ₸</span>
          </div>
        )}
        <div className={`${paymentsEnabled ? 'mt-1.5' : ''} flex justify-between text-sm font-extrabold text-ink`}>
          <span>{t('orderDetail.priceWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-border" />
        <div className="flex justify-between text-lg font-extrabold">
          <span>{t('orderDetail.priceTotalLabel')}</span>
          <span className="text-primary">{total} ₸</span>
        </div>
      </Card>
      {order.workComment && (
        <div className="rounded-md bg-fill p-3 text-xs leading-relaxed text-ink">«{order.workComment}»</div>
      )}
      <p className="text-xs leading-relaxed text-ink-soft">
        {paymentsEnabled
          ? t('orderDetail.priceRejectNote')
          : 'В бесплатном пилоте платформа не списывает деньги. После подтверждения вы рассчитываетесь с мастером напрямую; при отклонении заявка отменится.'}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <Button fullWidth onClick={confirm}>
        {t('orderDetail.priceConfirm', { price: order.workPrice })}
      </Button>
      <Button variant="danger" fullWidth onClick={reject}>
        {t('orderDetail.priceReject')}
      </Button>
    </div>
  );
}
