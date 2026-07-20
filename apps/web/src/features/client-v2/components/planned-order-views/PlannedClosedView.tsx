import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import PhotoStrip from '../PhotoStrip';
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PlannedClosedView({
  order,
  onChanged,
  photoUrls,
}: {
  order: PlannedOrderDetail;
  onChanged: () => void;
  photoUrls: string[];
}) {
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
        className={`flex h-19 w-19 items-center justify-center rounded-full text-4xl text-white ${
          isClosed ? 'bg-c2-success' : 'bg-c2-ink-soft'
        }`}
      >
        {isClosed ? '✓' : '×'}
      </div>
      <div className="text-xl font-extrabold text-c2-ink">{title}</div>
      {!isClosed && order.cancelReason && <div className="text-sm text-c2-ink-soft">{order.cancelReason}</div>}
      <PhotoStrip urls={photoUrls} />
      {isClosed && (
        <div className="w-full rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
          {order.review ? (
            <div className="text-sm font-extrabold text-c2-ink">{t('plannedDetail.rateThanks')}</div>
          ) : (
            <>
              <div className="mb-2 text-[13px] font-extrabold text-c2-ink">{t('plannedDetail.rateTitle')}</div>
              <div className="flex justify-center gap-1 text-[28px]">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={submitting}
                    onClick={() => submitRating(s)}
                    className={s <= rating ? 'text-c2-primary' : 'text-c2-border'}
                  >
                    ★
                  </button>
                ))}
              </div>
              {error && <div className="mt-2 text-xs font-semibold text-c2-danger">{error}</div>}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="w-full rounded-c2-pill bg-c2-primary p-4 text-sm font-extrabold text-white"
      >
        {t('plannedDetail.toHome')}
      </button>
    </div>
  );
}
