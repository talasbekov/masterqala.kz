'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-ink">{t('plannedDetail.doneTitle')}</div>
      <div className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-1.5 text-sm font-extrabold text-ink">{order.master?.name}</div>
        <div className="flex justify-between text-base font-extrabold text-ink">
          <span className="text-ink-soft">{t('plannedDetail.workLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
      </div>
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
        onClick={() => router.push(`/planned/${orderId}/dispute`)}
        className="rounded-pill border-[1.5px] border-danger p-3.5 text-sm font-extrabold text-danger"
      >
        {t('plannedDetail.openDispute')}
      </button>
    </div>
  );
}
