'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, CheckIcon, ScaleIcon } from '@masterqala/ui';
import { api } from '@/lib/api';
import type { PlannedOrderDetail } from '@/lib/plannedOrderTypes';

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
  const router = useRouter();
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3.5 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      <h1 className="text-lg font-extrabold text-ink">{t('plannedDetail.doneTitle')}</h1>
      <Card>
        <p className="mb-1.5 text-sm font-extrabold text-ink">{order.master?.name}</p>
        <div className="flex justify-between text-base font-extrabold text-ink">
          <span className="text-ink-soft">{t('plannedDetail.workLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
      </Card>
      <p className="text-xs leading-relaxed text-ink-soft">{t('plannedDetail.doneNote')}</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <Button variant="success" size="lg" fullWidth icon={<CheckIcon size={18} />} onClick={confirmDone}>
        {t('plannedDetail.confirmDone')}
      </Button>
      <Button
        variant="secondary"
        fullWidth
        icon={<ScaleIcon size={18} />}
        onClick={() => router.push(`/planned/${orderId}/dispute`)}
      >
        {t('plannedDetail.openDispute')}
      </Button>
    </div>
  );
}
