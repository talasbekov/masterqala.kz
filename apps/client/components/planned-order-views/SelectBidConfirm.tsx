'use client';
import { useState, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { PlannedBid } from '@/lib/plannedOrderTypes';

export default function SelectBidConfirm({
  plannedOrderId,
  bid,
  onBack,
  onSelected,
  disabled = false,
  canSubmit,
  onSubmittingChange,
  copy,
}: {
  plannedOrderId: string;
  bid: PlannedBid;
  onBack: () => void;
  onSelected?: () => void;
  disabled?: boolean;
  canSubmit?: () => boolean;
  onSubmittingChange?: (pending: boolean) => void;
  copy?: {title: string; note: string; confirm: string; back: string; orders: string; pending: string};
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const flight=useRef(false);
  const lifetime=useRef<object|null>(null);
  useLayoutEffect(()=>{
    const current={};lifetime.current=current;
    flight.current=false;setSubmitting(false);setError('');
    return()=>{lifetime.current=null;};
  },[plannedOrderId,bid.id]);

  async function confirmChoice() {
    const current=lifetime.current;
    if(!current||flight.current||disabled||(canSubmit&&!canSubmit()))return;
    flight.current=true;setSubmitting(true);
    onSubmittingChange?.(true);
    setError('');
    try {
      await api(`/planned-orders/${plannedOrderId}/select`, { method: 'POST', body: JSON.stringify({ bidId: bid.id }) });
      if(lifetime.current!==current)return;
      if(onSelected)onSelected();else router.push(`/planned/${plannedOrderId}`);
    } catch (e) {
      if(lifetime.current!==current)return;
      setError((e as Error).message);
      flight.current=false;setSubmitting(false);
      onSubmittingChange?.(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center gap-3.5 px-6 py-5.5">
      <div className="text-center text-xl font-extrabold text-ink">{copy?.title ?? t('plannedDetail.confirmTitle')}</div>
      <div className="rounded-lg border border-border bg-surface p-4 text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-fill text-base font-extrabold text-ink">
          {bid.master.name?.slice(0, 2).toUpperCase() ?? '—'}
        </div>
        <div className="text-base font-extrabold text-ink">{bid.master.name} {bid.master.verified && '✓'}</div>
        <div className="mt-0.5 text-xs font-semibold text-ink-soft">
          ★ {bid.master.rating?.toFixed(1) ?? '—'} · {copy ? `${copy.orders}: ${bid.master.completedCount}` : t('plannedDetail.ordersShort', { n: bid.master.completedCount })}
        </div>
        <div className="mt-2.5 text-[22px] font-extrabold text-primary">{bid.price} ₸</div>
      </div>
      <div className="rounded-md bg-fill p-3.5 text-xs font-semibold leading-relaxed text-ink">
        {copy?.note ?? t('plannedDetail.confirmNote')}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      <button
        type="button"
        onClick={confirmChoice}
        data-select-confirm
        disabled={submitting || disabled}
        aria-busy={submitting}
        className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
      >
        {copy ? (submitting ? copy.pending : copy.confirm) : t('plannedDetail.confirmChoice')}
      </button>
      <button type="button" onClick={onBack} disabled={submitting} className="text-center text-[13.5px] font-bold text-ink-soft">
        {copy?.back ?? t('plannedDetail.backToBids')}
      </button>
    </div>
  );
}
