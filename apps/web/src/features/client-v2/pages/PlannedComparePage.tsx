import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import SelectBidConfirm from '../components/planned-order-views/SelectBidConfirm';
import type { PlannedOrderDetail, PlannedBid } from './PlannedOrderPage';

export default function PlannedComparePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PlannedOrderDetail | null>(null);
  const [selected, setSelected] = useState<PlannedBid | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/planned-orders/${id}`).then(setOrder).catch((e) => setError((e as Error).message));
  }, [id]);

  if (selected && id) {
    return <SelectBidConfirm plannedOrderId={id} bid={selected} onBack={() => setSelected(null)} />;
  }

  if (error) return <div className="p-6 text-sm font-semibold text-c2-danger">{error}</div>;
  if (!order || !id) return <div className="p-6 text-c2-ink-soft">{t('common.loading')}</div>;

  const rows: { label: string; render: (b: PlannedBid) => string }[] = [
    { label: t('plannedDetail.comparePrice'), render: (b) => `${b.price} ₸` },
    { label: t('plannedDetail.compareRating'), render: (b) => `★ ${b.master.rating?.toFixed(1) ?? '—'}` },
    { label: t('plannedDetail.compareOrders'), render: (b) => String(b.master.completedCount) },
    { label: t('plannedDetail.compareExperience'), render: (b) => `${b.master.experienceYears} лет` },
    { label: t('plannedDetail.compareTerm'), render: (b) => b.term },
    { label: t('plannedDetail.compareComment'), render: (b) => b.comment ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate(`/planned/${id}`)} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="text-lg font-extrabold text-c2-ink">{t('plannedDetail.compareTitle')}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse overflow-hidden rounded-c2-lg border border-c2-border text-[12.5px]">
          <thead>
            <tr>
              <th className="bg-c2-fill-soft p-3" />
              {order.bids.map((b) => (
                <th key={b.id} className="border-l border-c2-border bg-c2-fill-soft p-2 text-center">
                  <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-c2-fill text-xs font-extrabold text-c2-ink">
                    {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
                  </div>
                  <span className="font-extrabold text-c2-ink">{b.master.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="border-t border-c2-border p-2.5 font-bold text-c2-ink-soft">{row.label}</td>
                {order.bids.map((b) => (
                  <td key={b.id} className="border-l border-t border-c2-border p-2.5 text-center font-extrabold text-c2-ink">
                    {row.render(b)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-[11.5px] text-c2-ink-soft">{t('plannedDetail.compareHint')}</p>
      <div className="mt-auto" />
      <div className="flex gap-2">
        {order.bids.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelected(b)}
            className="flex-1 rounded-c2-pill border-[1.5px] border-c2-primary p-3 text-[12.5px] font-extrabold text-c2-primary"
          >
            {t('plannedDetail.select')} {b.master.name}
          </button>
        ))}
      </div>
    </div>
  );
}
