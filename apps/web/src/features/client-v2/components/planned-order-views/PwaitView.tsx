import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { categoryMeta } from '../../categoryMeta';
import SelectBidConfirm from './SelectBidConfirm';
import type { PlannedOrderDetail, PlannedBid } from '../../pages/PlannedOrderPage';

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
  const navigate = useNavigate();
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
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate('/')} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="flex-1 truncate text-[17px] font-extrabold text-c2-ink">{order.category?.name}</span>
        <span className="rounded-c2-pill bg-c2-fill-soft px-2.5 py-1 text-[11px] font-extrabold text-c2-primary">
          {t('plannedDetail.publishedBadge')}
        </span>
      </div>
      <div className="rounded-c2-md bg-c2-fill px-3.5 py-2.5 text-[12.5px] font-semibold text-c2-ink">
        {categoryMeta(order.category?.slug ?? '').icon} {order.category?.name} · {when} · {order.district}
        {order.budget && ` · ~${order.budget} ₸`}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-extrabold text-c2-ink">
          {t('plannedDetail.offersCount', { n: order.bids.length })}
        </span>
      </div>
      {order.bids.length === 0 && (
        <div className="rounded-c2-lg border-[1.5px] border-dashed border-c2-border bg-c2-surface p-5.5 text-center">
          <div className="mx-auto mb-2.5 h-6 w-6 animate-spin rounded-full border-[3px] border-c2-border border-t-c2-primary" />
          <div className="whitespace-pre-line text-[13px] font-bold leading-relaxed text-c2-ink-soft">
            {t('plannedDetail.noBidsYet')}
          </div>
        </div>
      )}
      {order.bids.map((b) => (
        <div key={b.id} className="rounded-c2-lg border border-c2-border bg-c2-surface p-3.5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-c2-fill text-[13px] font-extrabold text-c2-ink">
                {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
              </div>
              <div>
                <div className="text-sm font-extrabold text-c2-ink">
                  {b.master.name} <span className="text-xs text-c2-success">✓</span>
                </div>
                <div className="text-[11.5px] font-semibold text-c2-ink-soft">
                  ★ {b.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: b.master.completedCount })} ·{' '}
                  {b.master.experienceYears} лет
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold text-c2-primary">{b.price} ₸</div>
              <div className="text-[11px] font-semibold text-c2-ink-soft">{t('plannedDetail.termLabel', { term: b.term })}</div>
            </div>
          </div>
          {b.comment && <div className="my-2 text-[12.5px] leading-snug text-c2-on-fill">«{b.comment}»</div>}
          <div className="flex items-center gap-1.5">
            {b.id === cheapestId && (
              <span className="rounded-c2-pill bg-c2-success-bg px-2.5 py-1 text-[10.5px] font-extrabold text-c2-success-ink">
                {t('plannedDetail.bestPrice')}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelected(b)}
              className="ml-auto rounded-c2-pill bg-c2-primary px-4.5 py-2 text-xs font-extrabold text-white"
            >
              {t('plannedDetail.select')}
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate(`/planned/${orderId}/compare`)}
          disabled={order.bids.length === 0}
          className="flex-1 rounded-c2-pill border-[1.5px] border-c2-primary p-3 text-[13.5px] font-extrabold text-c2-primary disabled:opacity-40"
        >
          {t('plannedDetail.compare', { n: order.bids.length })}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="flex-1 rounded-c2-pill border-[1.5px] border-c2-danger p-3 text-[13.5px] font-extrabold text-c2-danger"
        >
          {t('plannedDetail.cancel')}
        </button>
      </div>
    </div>
  );
}
