import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, CheckIcon, CloseIcon, IconButton, StarIcon } from '@masterqala/ui';
import { api } from '../../../../api';
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PlannedClosedView({ order, onChanged }: { order: PlannedOrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3.5 px-6 text-center">
      <div
        className={`flex h-19 w-19 items-center justify-center rounded-full ${
          isClosed ? 'bg-success text-on-success' : 'bg-ink-soft text-surface'
        }`}
      >
        {isClosed ? <CheckIcon size={36} /> : <CloseIcon size={36} />}
      </div>
      <div className="text-xl font-extrabold text-ink">{title}</div>
      {!isClosed && order.cancelReason && <div className="text-sm text-ink-soft">{order.cancelReason}</div>}
      {isClosed && (
        <Card className="w-full" padding="sm">
          {order.review ? (
            <div className="text-sm font-extrabold text-ink">{t('plannedDetail.rateThanks')}</div>
          ) : (
            <>
              <div className="mb-2 text-xs font-extrabold text-ink">{t('plannedDetail.rateTitle')}</div>
              {/* Каждая звезда — отдельная кнопка с доступным именем: без него
                  выбор оценки не озвучивается скринридером вовсе. */}
              <div className="flex justify-center gap-0.5" role="group" aria-label={t('plannedDetail.rateTitle')}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <IconButton
                    key={s}
                    label={`Оценка ${s} из 5`}
                    aria-pressed={s <= rating}
                    disabled={submitting}
                    onClick={() => submitRating(s)}
                    icon={
                      <StarIcon size={26} filled={s <= rating} className={s <= rating ? 'text-warning' : 'text-border'} />
                    }
                  />
                ))}
              </div>
              {error && (
                <Alert tone="danger" className="mt-2">
                  {error}
                </Alert>
              )}
            </>
          )}
        </Card>
      )}
      <Button fullWidth onClick={() => navigate('/')}>
        {t('plannedDetail.toHome')}
      </Button>
    </div>
  );
}
