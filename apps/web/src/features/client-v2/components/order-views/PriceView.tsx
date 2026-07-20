import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import PhotoStrip from '../PhotoStrip';
import type { OrderDetail } from '../../pages/OrderPage';

export default function PriceView({
  order,
  orderId,
  onChanged,
  photoUrls,
}: {
  order: OrderDetail;
  orderId: string;
  onChanged: () => void;
  photoUrls: string[];
}) {
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
        <span className="text-lg font-extrabold text-c2-ink">{t('orderDetail.priceTitle')}</span>
        <span className="rounded-c2-pill bg-c2-primary px-3 py-1.5 text-[13px] font-extrabold text-white">
          ⏱ {mm}:{String(ss).padStart(2, '0')}
        </span>
      </div>
      <div className="text-sm font-semibold text-c2-ink">{t('orderDetail.priceOffered', { name: order.master?.name })}</div>
      <div className="rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
        <div className="flex justify-between text-[13.5px] font-semibold text-c2-ink-soft">
          <span>{t('orderDetail.priceCalloutLabel')}</span>
          <span>{order.calloutPrice} ₸</span>
        </div>
        <div className="mt-1.5 flex justify-between text-sm font-extrabold text-c2-ink">
          <span>{t('orderDetail.priceWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-c2-border" />
        <div className="flex justify-between text-lg font-extrabold">
          <span>{t('orderDetail.priceTotalLabel')}</span>
          <span className="text-c2-primary">{total} ₸</span>
        </div>
      </div>
      {order.workComment && (
        <div className="rounded-c2-md bg-c2-fill p-3 text-[13px] leading-relaxed text-c2-ink">«{order.workComment}»</div>
      )}
      <PhotoStrip urls={photoUrls} />
      <p className="text-xs leading-relaxed text-c2-ink-soft">{t('orderDetail.priceRejectNote')}</p>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirm}
        className="rounded-c2-pill bg-c2-primary p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('orderDetail.priceConfirm', { price: order.workPrice })}
      </button>
      <button
        type="button"
        onClick={reject}
        className="rounded-c2-pill border-[1.5px] border-c2-danger p-3.5 text-sm font-extrabold text-c2-danger"
      >
        {t('orderDetail.priceReject')}
      </button>
    </div>
  );
}
