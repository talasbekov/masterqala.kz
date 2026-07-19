import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { PLANNED_STATUS_LABELS } from '../../../../orderStatus';
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PactiveView({ order, orderId }: { order: PlannedOrderDetail; orderId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order.confirmDeadline) return;
    const deadline = new Date(order.confirmDeadline).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order.confirmDeadline]);

  async function cancel() {
    setError('');
    try {
      await api(`/planned-orders/${orderId}/cancel`, { method: 'POST' });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const confirmed = order.status !== 'MASTER_SELECTED';
  const selectedBid = order.bids.find((b) => b.id === order.selectedBidId);
  const price = confirmed ? order.workPrice : selectedBid?.price;
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate('/')} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="flex-1 truncate text-[17px] font-extrabold text-c2-ink">{order.category?.name}</span>
        <span className="rounded-c2-pill bg-c2-fill-soft px-2.5 py-1 text-[11px] font-extrabold text-c2-primary">
          {PLANNED_STATUS_LABELS[order.status]}
        </span>
      </div>

      {!confirmed && (
        <div className="rounded-c2-lg border-[1.5px] border-dashed border-c2-border bg-c2-surface p-4.5 text-center">
          <div className="mx-auto mb-2.5 h-6 w-6 animate-spin rounded-full border-[3px] border-c2-border border-t-c2-primary" />
          <div className="text-[13.5px] font-bold leading-relaxed text-c2-ink">
            {t('plannedDetail.waitingConfirm', { name: order.master?.name })}
          </div>
          <div className="mt-1 text-xs font-semibold text-c2-ink-soft">
            {t('plannedDetail.waitingConfirmHint')} · {mm}:{String(ss).padStart(2, '0')}
          </div>
        </div>
      )}

      {confirmed && (
        <>
          <div className="rounded-c2-md bg-c2-success-bg p-3.5 text-[13px] font-bold text-c2-success-ink">
            ✓ {t('plannedDetail.confirmed', { name: order.master?.name })}
          </div>
          <div className="rounded-c2-lg border border-c2-border bg-c2-surface p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-c2-fill text-sm font-extrabold text-c2-ink">
                {order.master?.name?.slice(0, 2).toUpperCase() ?? '—'}
              </div>
              <div className="flex-1">
                <div className="text-[14.5px] font-extrabold text-c2-ink">
                  {order.master?.name} <span className="text-xs text-c2-success">✓</span>
                </div>
              </div>
              {order.master?.phone && (
                <a
                  href={`tel:${order.master.phone}`}
                  className="flex h-10.5 w-10.5 items-center justify-center rounded-full bg-c2-primary text-base text-white"
                >
                  📞
                </a>
              )}
            </div>
            <div className="my-2.5 border-t border-c2-fill-soft" />
            <div className="flex justify-between text-[13px] font-bold">
              <span className="text-c2-ink-soft">{t('plannedDetail.workLabel')}</span>
              <span className="text-c2-ink">{price} ₸</span>
            </div>
            <div className="mt-1 flex justify-between text-[13px] font-bold">
              <span className="text-c2-ink-soft">{t('plannedDetail.whenLabel')}</span>
              <span className="text-c2-ink">{new Date(order.slotStart).toLocaleString('ru-RU', { weekday: 'short', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </>
      )}

      <div className="rounded-c2-md bg-c2-fill px-3.5 py-2.5 text-[12.5px] font-semibold text-c2-ink">
        {order.category?.name} · «{order.description.slice(0, 40)}» · {order.address}
      </div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={cancel}
        className="rounded-c2-pill border-[1.5px] border-c2-danger p-3.5 text-sm font-extrabold text-c2-danger"
      >
        {t('plannedDetail.cancel')}
      </button>
    </div>
  );
}
