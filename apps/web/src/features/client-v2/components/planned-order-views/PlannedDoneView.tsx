import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import PhotoStrip from '../PhotoStrip';
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PlannedDoneView({
  order,
  orderId,
  onChanged,
  photoUrls,
}: {
  order: PlannedOrderDetail;
  orderId: string;
  onChanged: () => void;
  photoUrls: string[];
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
      <div className="text-lg font-extrabold text-ink">{t('plannedDetail.doneTitle')}</div>
      <div className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-1.5 text-sm font-extrabold text-ink">{order.master?.name}</div>
        <div className="flex justify-between text-base font-extrabold text-ink">
          <span className="text-ink-soft">{t('plannedDetail.workLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
      </div>
      <PhotoStrip urls={photoUrls} />
      <p className="text-xs leading-relaxed text-ink-soft">{t('plannedDetail.doneNote')}</p>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={confirmDone}
        className="rounded-pill bg-success p-4 text-[15.5px] font-extrabold text-white"
      >
        {t('plannedDetail.confirmDone')}
      </button>
      <button
        type="button"
        onClick={() => navigate(`/planned/${orderId}/dispute`)}
        className="rounded-pill border-[1.5px] border-danger p-3.5 text-sm font-extrabold text-danger"
      >
        {t('plannedDetail.openDispute')}
      </button>
    </div>
  );
}
