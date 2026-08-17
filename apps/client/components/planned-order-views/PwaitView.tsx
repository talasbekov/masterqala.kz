'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ArrowLeftIcon,
  Badge,
  Button,
  Card,
  CheckIcon,
  IconButton,
  Spinner,
  StarIcon,
} from '@masterqala/ui';
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
  const { Icon } = categoryMeta(order.category?.slug ?? '');

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      <div className="flex items-center gap-2.5">
        <IconButton label={t('common.back')} icon={<ArrowLeftIcon size={20} />} onClick={() => router.push('/')} />
        <h1 className="flex-1 truncate text-base font-extrabold text-ink">{order.category?.name}</h1>
        <Badge tone="primary">{t('plannedDetail.publishedBadge')}</Badge>
      </div>
      <p className="flex items-center gap-2 rounded-md bg-surface-sunken px-3.5 py-2.5 text-xs font-semibold text-on-fill">
        <Icon size={18} className="shrink-0 text-primary" />
        <span>
          {order.category?.name} · {when} · {order.district}
          {order.budget && ` · ~${order.budget} ₸`}
        </span>
      </p>
      <h2 className="text-sm font-extrabold text-ink">{t('plannedDetail.offersCount', { n: order.bids.length })}</h2>
      {order.bids.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-center">
          <Spinner size={24} className="mx-auto mb-2.5 text-primary" label={t('common.loading')} />
          <p className="text-xs leading-relaxed font-bold whitespace-pre-line text-ink-soft">
            {t('plannedDetail.noBidsYet')}
          </p>
        </div>
      )}
      {order.bids.map((b) => (
        <Card key={b.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-extrabold text-ink">
                {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
              </span>
              <div>
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-ink">
                  {b.master.name}
                  <Badge tone="success" icon={<CheckIcon size={14} />}>
                    {t('orderDetail.verified')}
                  </Badge>
                </p>
                <p className="flex items-center gap-1 text-2xs font-semibold text-ink-soft">
                  <StarIcon size={13} filled className="text-warning" />
                  {b.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: b.master.completedCount })}{' '}
                  · {b.master.experienceYears} лет
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-extrabold text-primary">{b.price} ₸</p>
              <p className="text-2xs font-semibold text-ink-soft">{t('plannedDetail.termLabel', { term: b.term })}</p>
            </div>
          </div>
          {b.comment && <p className="my-2 text-xs leading-snug text-on-fill">«{b.comment}»</p>}
          <div className="flex items-center gap-1.5">
            {b.id === cheapestId && <Badge tone="success">{t('plannedDetail.bestPrice')}</Badge>}
            <Button size="sm" className="ml-auto" onClick={() => setSelected(b)}>
              {t('plannedDetail.select')}
            </Button>
          </div>
        </Card>
      ))}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          fullWidth
          disabled={order.bids.length === 0}
          onClick={() => router.push(`/planned/${orderId}/compare`)}
        >
          {t('plannedDetail.compare', { n: order.bids.length })}
        </Button>
        <Button variant="secondary" fullWidth onClick={cancel}>
          {t('plannedDetail.cancel')}
        </Button>
      </div>
    </div>
  );
}
