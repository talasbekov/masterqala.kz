'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Alert, ArrowLeftIcon, Button, IconButton, SkeletonList } from '@masterqala/ui';
import { api } from '@/lib/api';
import SelectBidConfirm from '@/components/planned-order-views/SelectBidConfirm';
import type { PlannedOrderDetail, PlannedBid } from '@/lib/plannedOrderTypes';

export default function PlannedComparePage() {
  const { t } = useTranslation();
  const router = useRouter();
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

  if (error)
    return (
      <div className="p-6">
        <Alert tone="danger">{error}</Alert>
      </div>
    );
  if (!order || !id)
    return (
      <div className="p-6">
        <SkeletonList rows={3} label={t('common.loading')} />
      </div>
    );

  const rows: { label: string; render: (b: PlannedBid) => string }[] = [
    { label: t('plannedDetail.comparePrice'), render: (b) => `${b.price} ₸` },
    { label: t('plannedDetail.compareRating'), render: (b) => b.master.rating?.toFixed(1) ?? '—' },
    { label: t('plannedDetail.compareOrders'), render: (b) => String(b.master.completedCount) },
    { label: t('plannedDetail.compareExperience'), render: (b) => `${b.master.experienceYears} лет` },
    { label: t('plannedDetail.compareTerm'), render: (b) => b.term },
    { label: t('plannedDetail.compareComment'), render: (b) => b.comment ?? '—' },
  ];

  return (
    <div className="flex w-full flex-col gap-3 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      <div className="flex items-center gap-2.5">
        <IconButton
          label={t('common.back')}
          icon={<ArrowLeftIcon size={20} />}
          onClick={() => router.push(`/planned/${id}`)}
        />
        <h1 className="text-lg font-extrabold text-ink">{t('plannedDetail.compareTitle')}</h1>
      </div>
      {/* Широкая таблица скроллится внутри своего контейнера, а не страницей. */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse rounded-lg border border-border text-xs">
          <caption className="sr-only">{t('plannedDetail.compareTitle')}</caption>
          <thead>
            <tr>
              <th scope="col" className="bg-surface-sunken p-3">
                <span className="sr-only">{t('plannedDetail.compareCriterion')}</span>
              </th>
              {order.bids.map((b) => (
                <th key={b.id} scope="col" className="border-l border-border bg-surface-sunken p-2 text-center">
                  <span className="mx-auto mb-1 flex size-9 items-center justify-center rounded-full bg-fill text-2xs font-extrabold text-ink">
                    {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
                  </span>
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
                  <td key={b.id} className="border-t border-l border-border p-2.5 text-center font-extrabold text-ink">
                    {row.render(b)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-2xs text-ink-soft">{t('plannedDetail.compareHint')}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {order.bids.map((b) => (
          <Button key={b.id} variant="secondary" fullWidth onClick={() => setSelected(b)}>
            {t('plannedDetail.select')} {b.master.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
