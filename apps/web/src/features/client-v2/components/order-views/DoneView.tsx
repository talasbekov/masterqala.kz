import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import PhotoStrip from '../PhotoStrip';
import type { OrderDetail } from '../../pages/OrderPage';

export default function DoneView({
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
  const paymentsEnabled = order.commercialMode !== 'FREE_PILOT' && order.freePilot !== true;
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function confirmDone() {
    setError('');
    try {
      await api(`/orders/${orderId}/confirm-completion`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const total = order.calloutPrice + (order.workPrice ?? 0);

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-ink">{t('orderDetail.doneTitle')}</div>
      <div className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-2.5 text-sm font-extrabold text-ink">{order.master?.name}</div>
        {paymentsEnabled && (
          <div className="flex justify-between text-[13.5px] font-semibold text-ink-soft">
            <span>{t('orderDetail.doneCalloutLabel')}</span>
            <span>{order.calloutPrice} ₸</span>
          </div>
        )}
        <div className={`${paymentsEnabled ? 'mt-1' : ''} flex justify-between text-[13.5px] font-semibold text-ink-soft`}>
          <span>{t('orderDetail.doneWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-border" />
        <div className="flex justify-between text-base font-extrabold text-ink">
          <span>{t('orderDetail.doneTotalLabel')}</span>
          <span>{total} ₸</span>
        </div>
      </div>
      <PhotoStrip urls={photoUrls} />
      <p className="text-xs leading-relaxed text-ink-soft">
        {paymentsEnabled
          ? t('orderDetail.doneNote')
          : 'Проверьте результат и подтвердите выполнение. Оплата работ производится мастеру напрямую. При проблеме откройте спор.'}
      </p>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirmDone}
        className="rounded-pill bg-success p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('orderDetail.confirmDone')}
      </button>
      <button
        type="button"
        onClick={() => navigate(`/order/${orderId}/dispute`)}
        className="rounded-pill border-[1.5px] border-danger p-3.5 text-sm font-extrabold text-danger"
      >
        {t('orderDetail.openDispute')}
      </button>
    </div>
  );
}
