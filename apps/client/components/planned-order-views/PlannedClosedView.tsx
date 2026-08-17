'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button, Card, CheckIcon, CloseIcon, IconButton, StarIcon } from '@masterqala/ui';
import { api } from '@/lib/api';
import type { PlannedOrderDetail } from '@/lib/plannedOrderTypes';

export default function PlannedClosedView({ order, onChanged }: { order: PlannedOrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isClosed = order.status === 'CLOSED';
  const isExpired = order.status === 'EXPIRED';

  async function submitRating(stars: number) {
    setRating(stars);
    setSubmitting(true);
    setError('');
    try {
      await api(`/planned-orders/${order.id}/review`, { method: 'POST', body: JSON.stringify({ rating: stars }) });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const title = isClosed
    ? t('plannedDetail.closedTitle')
    : isExpired
      ? t('plannedDetail.closedExpiredTitle')
      : t('plannedDetail.closedCancelledTitle');

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-xl flex-col items-center justify-center gap-3.5 px-6 text-center">
      <span
        className={`flex size-19 items-center justify-center rounded-full ${
          isClosed ? 'bg-success text-on-success' : 'bg-ink-soft text-surface'
        }`}
        aria-hidden="true"
      >
        {isClosed ? <CheckIcon size={36} /> : <CloseIcon size={36} />}
      </span>
      <h1 className="text-xl font-extrabold text-ink">{title}</h1>
      {!isClosed && order.cancelReason && <p className="text-sm text-ink-soft">{order.cancelReason}</p>}
      {isClosed && (
        <Card className="w-full">
          {order.review ? (
            <p className="text-sm font-extrabold text-ink">{t('plannedDetail.rateThanks')}</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-extrabold text-ink">{t('plannedDetail.rateTitle')}</p>
              <div className="flex justify-center gap-1" role="group" aria-label={t('plannedDetail.rateTitle')}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <IconButton
                    key={s}
                    label={t('orderDetail.rateStars', { n: s })}
                    disabled={submitting}
                    aria-pressed={s <= rating}
                    onClick={() => submitRating(s)}
                    icon={
                      <StarIcon
                        size={26}
                        filled={s <= rating}
                        className={s <= rating ? 'text-warning' : 'text-border-strong'}
                      />
                    }
                  />
                ))}
              </div>
              {error && (
                <p role="alert" className="mt-2 text-xs font-semibold text-danger">
                  {error}
                </p>
              )}
            </>
          )}
        </Card>
      )}
      <Button size="lg" fullWidth onClick={() => router.push('/')}>
        {t('plannedDetail.toHome')}
      </Button>
    </div>
  );
}
