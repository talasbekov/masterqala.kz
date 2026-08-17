'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Card, CheckIcon, StarIcon } from '@masterqala/ui';
import { api } from '@/lib/api';
import type { PlannedBid } from '@/lib/plannedOrderTypes';

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
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function confirmChoice() {
    setSubmitting(true);
    setError('');
    try {
      await api(`/planned-orders/${plannedOrderId}/select`, { method: 'POST', body: JSON.stringify({ bidId: bid.id }) });
      router.push(`/planned/${plannedOrderId}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3.5 px-6 py-6">
      <h1 className="text-center text-xl font-extrabold text-ink">{t('plannedDetail.confirmTitle')}</h1>
      <Card className="text-center">
        <span className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-fill text-base font-extrabold text-ink">
          {bid.master.name?.slice(0, 2).toUpperCase() ?? '—'}
        </span>
        <p className="flex flex-wrap items-center justify-center gap-1.5 text-base font-extrabold text-ink">
          {bid.master.name}
          <Badge tone="success" icon={<CheckIcon size={14} />}>
            {t('orderDetail.verified')}
          </Badge>
        </p>
        <p className="mt-0.5 flex items-center justify-center gap-1 text-xs font-semibold text-ink-soft">
          <StarIcon size={14} filled className="text-warning" />
          {bid.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: bid.master.completedCount })}
        </p>
        <p className="mt-2.5 text-xl font-extrabold text-primary">{bid.price} ₸</p>
      </Card>
      <p className="rounded-md bg-surface-sunken p-3.5 text-xs leading-relaxed font-semibold text-on-fill">
        {t('plannedDetail.confirmNote')}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button size="lg" fullWidth loading={submitting} onClick={confirmChoice}>
        {t('plannedDetail.confirmChoice')}
      </Button>
      <Button variant="ghost" fullWidth onClick={onBack}>
        {t('plannedDetail.backToBids')}
      </Button>
    </div>
  );
}
