import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PlannedDoneView({
  order,
  orderId,
  onChanged,
}: {
  order: PlannedOrderDetail;
  orderId: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function confirmDone() {
    setError('');
    try {
      await api(`/planned-orders/${orderId}/confirm-completion`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-c2-ink">{t('plannedDetail.doneTitle')}</div>
      <div className="rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
        <div className="mb-1.5 text-sm font-extrabold text-c2-ink">{order.master?.name}</div>
        <div className="flex justify-between text-base font-extrabold text-c2-ink">
          <span className="text-c2-ink-soft">{t('plannedDetail.workLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-c2-ink-soft">{t('plannedDetail.doneNote')}</p>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirmDone}
        className="rounded-c2-pill bg-c2-success p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('plannedDetail.confirmDone')}
      </button>
      <button
        type="button"
        onClick={() => navigate(`/planned/${orderId}/dispute`)}
        className="rounded-c2-pill border-[1.5px] border-c2-danger p-3.5 text-sm font-extrabold text-c2-danger"
      >
        {t('plannedDetail.openDispute')}
      </button>
    </div>
  );
}
