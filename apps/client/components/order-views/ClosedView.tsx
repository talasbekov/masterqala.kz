'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button, Card, CheckIcon, CloseIcon, IconButton, StarIcon } from '@masterqala/ui';
import { api } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/orderStatus';
import type { OrderDetail } from '@/lib/orderTypes';

export default function ClosedView({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isCancelled = order.status !== 'CLOSED';

  async function submitRating(stars: number) {
    setRating(stars);
    setSubmitting(true);
    setError('');
    try {
      await api(`/orders/${order.id}/review`, { method: 'POST', body: JSON.stringify({ rating: stars }) });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-xl flex-col items-center justify-center gap-3.5 px-6 text-center">
      <span
        className={`flex size-19 items-center justify-center rounded-full ${
          isCancelled ? 'bg-ink-soft text-surface' : 'bg-success text-on-success'
        }`}
        aria-hidden="true"
      >
        {isCancelled ? <CloseIcon size={36} /> : <CheckIcon size={36} />}
      </span>
      <h1 className="text-xl font-extrabold text-ink">
        {isCancelled ? t('orderDetail.closedCancelledTitle') : t('orderDetail.closedTitle')}
      </h1>
      {isCancelled && order.cancelReason && <p className="text-sm text-ink-soft">{order.cancelReason}</p>}
      {!isCancelled && (
        <Card className="w-full">
          {order.review ? (
            <p className="text-sm font-extrabold text-ink">{t('orderDetail.rateThanks')}</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-extrabold text-ink">{t('orderDetail.rateTitle')}</p>
              <div className="flex justify-center gap-1" role="group" aria-label={t('orderDetail.rateTitle')}>
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
        {t('orderDetail.toHome')}
      </Button>
      {!isCancelled && (
        <Button variant="ghost" size="sm" onClick={() => router.push(`/order/${order.id}/dispute`)}>
          {STATUS_LABELS[order.status]}? {t('orderDetail.openDispute')}
        </Button>
      )}
    </div>
  );
}
