import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, CheckIcon, StarIcon } from '@masterqala/ui';
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
      <div className="text-center text-xl font-extrabold text-ink">{t('plannedDetail.confirmTitle')}</div>
      <Card className="text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-fill text-base font-extrabold text-ink">
          {bid.master.name?.slice(0, 2).toUpperCase() ?? '—'}
        </div>
        <div className="flex items-center justify-center gap-1 text-base font-extrabold text-ink">
          {bid.master.name}
          <CheckIcon size={16} className="shrink-0 text-success" title={t('orderDetail.verified')} />
        </div>
        <div className="mt-0.5 flex items-center justify-center gap-1 text-xs font-semibold text-ink-soft">
          <StarIcon size={13} className="shrink-0 text-warning" />
          {bid.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: bid.master.completedCount })}
        </div>
        <div className="mt-2.5 text-xl font-extrabold text-primary">{bid.price} ₸</div>
      </Card>
      <div className="rounded-md bg-fill p-3.5 text-xs font-semibold leading-relaxed text-ink">
        {t('plannedDetail.confirmNote')}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button fullWidth loading={submitting} onClick={confirmChoice}>
        {t('plannedDetail.confirmChoice')}
      </Button>
      <Button variant="ghost" fullWidth onClick={onBack}>
        {t('plannedDetail.backToBids')}
      </Button>
    </div>
  );
}
