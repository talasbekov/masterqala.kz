import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import type { PlannedBid } from '../../pages/PlannedOrderPage';

export default function SelectBidConfirm({
  plannedOrderId,
  bid,
  onBack,
}: {
  plannedOrderId: string;
  bid: PlannedBid;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function confirmChoice() {
    setSubmitting(true);
    setError('');
    try {
      await api(`/planned-orders/${plannedOrderId}/select`, { method: 'POST', body: JSON.stringify({ bidId: bid.id }) });
      navigate(`/planned/${plannedOrderId}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-3.5 px-6 py-5.5">
      <div className="text-center text-xl font-extrabold text-c2-ink">{t('plannedDetail.confirmTitle')}</div>
      <div className="rounded-c2-lg border border-c2-border bg-c2-surface p-4 text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-c2-fill text-base font-extrabold text-c2-ink">
          {bid.master.name?.slice(0, 2).toUpperCase() ?? '—'}
        </div>
        <div className="text-base font-extrabold text-c2-ink">{bid.master.name} ✓</div>
        <div className="mt-0.5 text-xs font-semibold text-c2-ink-soft">
          ★ {bid.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: bid.master.completedCount })}
        </div>
        <div className="mt-2.5 text-[22px] font-extrabold text-c2-primary">{bid.price} ₸</div>
      </div>
      <div className="rounded-c2-md bg-c2-fill p-3.5 text-xs font-semibold leading-relaxed text-c2-ink">
        {t('plannedDetail.confirmNote')}
      </div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <button
        type="button"
        onClick={confirmChoice}
        disabled={submitting}
        className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
      >
        {t('plannedDetail.confirmChoice')}
      </button>
      <button type="button" onClick={onBack} className="text-center text-[13.5px] font-bold text-c2-ink-soft">
        {t('plannedDetail.backToBids')}
      </button>
    </div>
  );
}
