import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import type { OrderDetail } from '../../pages/OrderPage';

export default function PriceView({ order, orderId, onChanged }: { order: OrderDetail; orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
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
        <span className="rounded-pill bg-primary px-3 py-1.5 text-[13px] font-extrabold text-white">
          ⏱ {mm}:{String(ss).padStart(2, '0')}
        </span>
      </div>
      <div className="text-sm font-semibold text-ink">{t('orderDetail.priceOffered', { name: order.master?.name })}</div>
      <div className="rounded-md border border-border bg-surface p-3.5">
        <div className="flex justify-between text-[13.5px] font-semibold text-ink-soft">
          <span>{t('orderDetail.priceCalloutLabel')}</span>
          <span>{order.calloutPrice} ₸</span>
        </div>
        <div className="mt-1.5 flex justify-between text-sm font-extrabold text-ink">
          <span>{t('orderDetail.priceWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-border" />
        <div className="flex justify-between text-lg font-extrabold">
          <span>{t('orderDetail.priceTotalLabel')}</span>
          <span className="text-primary">{total} ₸</span>
        </div>
      </div>
      {order.workComment && (
        <div className="rounded-md bg-fill p-3 text-[13px] leading-relaxed text-ink">«{order.workComment}»</div>
      )}
      <p className="text-xs leading-relaxed text-ink-soft">{t('orderDetail.priceRejectNote')}</p>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirm}
        className="rounded-pill bg-primary p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('orderDetail.priceConfirm', { price: order.workPrice })}
      </button>
      <button
        type="button"
        onClick={reject}
        className="rounded-pill border-[1.5px] border-danger p-3.5 text-sm font-extrabold text-danger"
      >
        {t('orderDetail.priceReject')}
      </button>
    </div>
  );
}
