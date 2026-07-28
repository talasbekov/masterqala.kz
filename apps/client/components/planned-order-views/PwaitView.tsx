'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { categoryMeta } from '@/lib/categoryMeta';
import SelectBidConfirm from './SelectBidConfirm';
import type { PlannedOrderDetail, PlannedBid } from '@/lib/plannedOrderTypes';

export default function PwaitView({
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
  const [selected, setSelected] = useState<PlannedBid | null>(null);
  const [error, setError] = useState('');

  async function cancel() {
    setError('');
    try {
      await api(`/planned-orders/${orderId}/cancel`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (selected) {
    return <SelectBidConfirm plannedOrderId={orderId} bid={selected} onBack={() => setSelected(null)} />;
  }

  const cheapestId = order.bids.length ? order.bids.reduce((a, b) => (b.price < a.price ? b : a)).id : null;
  const slotDate = new Date(order.slotStart);
  const when = `${slotDate.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })}`;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => router.push('/')} className="text-xl text-primary">
          ←
        </button>
        <span className="flex-1 truncate text-[17px] font-extrabold text-ink">{order.category?.name}</span>
        <span className="rounded-pill bg-fill-soft px-2.5 py-1 text-[11px] font-extrabold text-primary">
          {t('plannedDetail.publishedBadge')}
        </span>
      </div>
      <div className="rounded-md bg-fill px-3.5 py-2.5 text-[12.5px] font-semibold text-ink">
        {categoryMeta(order.category?.slug ?? '').icon} {order.category?.name} · {when} · {order.district}
        {order.budget && ` · ~${order.budget} ₸`}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-extrabold text-ink">
          {t('plannedDetail.offersCount', { n: order.bids.length })}
        </span>
      </div>
      {order.bids.length === 0 && (
        <div className="rounded-lg border-[1.5px] border-dashed border-border bg-surface p-5.5 text-center">
          <div className="mx-auto mb-2.5 h-6 w-6 animate-spin rounded-full border-[3px] border-border border-t-primary" />
          <div className="whitespace-pre-line text-[13px] font-bold leading-relaxed text-ink-soft">
            {t('plannedDetail.noBidsYet')}
          </div>
        </div>
      )}
      {order.bids.map((b) => (
        <div key={b.id} className="rounded-lg border border-border bg-surface p-3.5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fill text-[13px] font-extrabold text-ink">
                {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
              </div>
              <div>
                <div className="text-sm font-extrabold text-ink">
                  {b.master.name} <span className="text-xs text-success">✓</span>
                </div>
                <div className="text-[11.5px] font-semibold text-ink-soft">
                  ★ {b.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: b.master.completedCount })} ·{' '}
                  {b.master.experienceYears} лет
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold text-primary">{b.price} ₸</div>
              <div className="text-[11px] font-semibold text-ink-soft">{t('plannedDetail.termLabel', { term: b.term })}</div>
            </div>
          </div>
          {b.comment && <div className="my-2 text-[12.5px] leading-snug text-on-fill">«{b.comment}»</div>}
          <div className="flex items-center gap-1.5">
            {b.id === cheapestId && (
              <span className="rounded-pill bg-success-bg px-2.5 py-1 text-[10.5px] font-extrabold text-success-ink">
                {t('plannedDetail.bestPrice')}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelected(b)}
              className="ml-auto rounded-pill bg-primary px-4.5 py-2 text-xs font-extrabold text-white"
            >
              {t('plannedDetail.select')}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-auto" />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.push(`/planned/${orderId}/compare`)}
          disabled={order.bids.length === 0}
          className="flex-1 rounded-pill border-[1.5px] border-primary p-3 text-[13.5px] font-extrabold text-primary disabled:opacity-40"
        >
          {t('plannedDetail.compare', { n: order.bids.length })}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="flex-1 rounded-pill border-[1.5px] border-danger p-3 text-[13.5px] font-extrabold text-danger"
        >
          {t('plannedDetail.cancel')}
        </button>
      </div>
    </div>
  );
}
