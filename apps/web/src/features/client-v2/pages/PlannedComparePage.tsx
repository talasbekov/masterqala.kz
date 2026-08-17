import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Alert, ArrowLeftIcon, Button, IconButton, SkeletonList, StarIcon } from '@masterqala/ui';
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

  if (error) return <Alert tone="danger" className="m-5">{error}</Alert>;
  if (!order || !id) return <SkeletonList rows={3} label={t('common.loading')} className="p-5" />;

  const rows: { label: string; render: (b: PlannedBid) => ReactNode }[] = [
    { label: t('plannedDetail.comparePrice'), render: (b) => `${b.price} ₸` },
    {
      label: t('plannedDetail.compareRating'),
      render: (b) => (
        <span className="inline-flex items-center justify-center gap-1">
          <StarIcon size={14} className="text-warning" />
          {b.master.rating?.toFixed(1) ?? '—'}
        </span>
      ),
    },
    { label: t('plannedDetail.compareOrders'), render: (b) => String(b.master.completedCount) },
    { label: t('plannedDetail.compareExperience'), render: (b) => `${b.master.experienceYears} лет` },
    { label: t('plannedDetail.compareTerm'), render: (b) => b.term },
    { label: t('plannedDetail.compareComment'), render: (b) => b.comment ?? '—' },
  ];

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <IconButton
          label={t('common.back')}
          icon={<ArrowLeftIcon />}
          onClick={() => navigate(`/planned/${id}`)}
        />
        <h1 className="text-lg font-extrabold text-ink">{t('plannedDetail.compareTitle')}</h1>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse overflow-hidden rounded-lg border border-border text-xs">
          <caption className="sr-only">{t('plannedDetail.compareTitle')}</caption>
          <thead>
            <tr>
              <th scope="col" className="bg-fill-soft p-3">
                <span className="sr-only">{t('plannedDetail.compareTitle')}</span>
              </th>
              {order.bids.map((b) => (
                <th scope="col" key={b.id} className="border-l border-border bg-fill-soft p-2 text-center">
                  <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-fill text-xs font-extrabold text-ink">
                    {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
                  </div>
                  <span className="font-extrabold text-ink">{b.master.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="border-t border-border p-2.5 text-left font-bold text-ink-soft">
                  {row.label}
                </th>
                {order.bids.map((b) => (
                  <td key={b.id} className="border-l border-t border-border p-2.5 text-center font-extrabold text-ink">
                    {row.render(b)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-2xs text-ink-soft">{t('plannedDetail.compareHint')}</p>
      <div className="mt-auto" />
      <div className="flex gap-2">
        {order.bids.map((b) => (
          <Button key={b.id} variant="secondary" className="flex-1" onClick={() => setSelected(b)}>
            {t('plannedDetail.select')} {b.master.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
