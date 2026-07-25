import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { STATUS_LABELS } from '../../../../orderStatus';
import type { OrderDetail } from '../../pages/OrderPage';

export default function ClosedView({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-3.5 px-6 text-center">
      <div
        className={`flex h-19 w-19 items-center justify-center rounded-full text-4xl text-white ${
          isCancelled ? 'bg-ink-soft' : 'bg-success'
        }`}
      >
        {isCancelled ? '×' : '✓'}
      </div>
      <div className="text-xl font-extrabold text-ink">
        {isCancelled ? t('orderDetail.closedCancelledTitle') : t('orderDetail.closedTitle')}
      </div>
      {isCancelled && order.cancelReason && <div className="text-sm text-ink-soft">{order.cancelReason}</div>}
      {!isCancelled && (
        <div className="w-full rounded-md border border-border bg-surface p-3.5">
          {order.review ? (
            <div className="text-sm font-extrabold text-ink">{t('orderDetail.rateThanks')}</div>
          ) : (
            <>
              <div className="mb-2 text-[13px] font-extrabold text-ink">{t('orderDetail.rateTitle')}</div>
              <div className="flex justify-center gap-1 text-[28px]">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={submitting}
                    onClick={() => submitRating(s)}
                    className={s <= rating ? 'text-primary' : 'text-border'}
                  >
                    ★
                  </button>
                ))}
              </div>
              {error && <div className="mt-2 text-xs font-semibold text-danger">{error}</div>}
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="w-full rounded-pill bg-primary p-4 text-sm font-extrabold text-white"
      >
        {t('orderDetail.toHome')}
      </button>
      {!isCancelled && (
        <button type="button" onClick={() => navigate(`/order/${order.id}/dispute`)} className="text-xs font-bold text-ink-soft">
          {STATUS_LABELS[order.status]}? {t('orderDetail.openDispute')}
        </button>
      )}
    </div>
  );
}
