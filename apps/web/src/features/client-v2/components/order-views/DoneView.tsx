import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import type { OrderDetail } from '../../pages/OrderPage';

export default function DoneView({ order, orderId, onChanged }: { order: OrderDetail; orderId: string; onChanged: () => void }) {
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
      <div className="text-lg font-extrabold text-c2-ink">{t('orderDetail.doneTitle')}</div>
      <div className="rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
        <div className="mb-2.5 text-sm font-extrabold text-c2-ink">{order.master?.name}</div>
        {paymentsEnabled && (
          <div className="flex justify-between text-[13.5px] font-semibold text-c2-ink-soft">
            <span>{t('orderDetail.doneCalloutLabel')}</span>
            <span>{order.calloutPrice} ₸</span>
          </div>
        )}
        <div className={`${paymentsEnabled ? 'mt-1' : ''} flex justify-between text-[13.5px] font-semibold text-c2-ink-soft`}>
          <span>{t('orderDetail.doneWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-c2-border" />
        <div className="flex justify-between text-base font-extrabold text-c2-ink">
          <span>{t('orderDetail.doneTotalLabel')}</span>
          <span>{total} ₸</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-c2-ink-soft">
        {paymentsEnabled
          ? t('orderDetail.doneNote')
          : 'Проверьте результат и подтвердите выполнение. Оплата работ производится мастеру напрямую. При проблеме откройте спор.'}
      </p>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirmDone}
        className="rounded-c2-pill bg-c2-success p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('orderDetail.confirmDone')}
      </button>
      <button
        type="button"
        onClick={() => navigate(`/order/${orderId}/dispute`)}
        className="rounded-c2-pill border-[1.5px] border-c2-danger p-3.5 text-sm font-extrabold text-c2-danger"
      >
        {t('orderDetail.openDispute')}
      </button>
    </div>
  );
}
