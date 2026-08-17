import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ArrowLeftIcon,
  Badge,
  Button,
  Card,
  CheckIcon,
  IconButton,
  PhoneIcon,
  Spinner,
} from '@masterqala/ui';
import { api } from '../../../../api';
import { PLANNED_STATUS_LABELS } from '../../../../orderStatus';
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PactiveView({
  order,
  orderId,
  onChanged,
}: {
  order: PlannedOrderDetail;
  orderId: string;
  onChanged: () => void;
}) {
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
      onChanged();
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
        <IconButton label={t('common.back')} icon={<ArrowLeftIcon />} onClick={() => navigate('/')} className="-ml-2.5" />
        <span className="flex-1 truncate text-base font-extrabold text-ink">{order.category?.name}</span>
        <Badge tone="primary">{PLANNED_STATUS_LABELS[order.status]}</Badge>
      </div>

      {!confirmed && (
        <div className="rounded-lg border-[1.5px] border-dashed border-border bg-surface p-4.5 text-center">
          <div className="mb-2.5 flex justify-center text-primary">
            <Spinner size={24} />
          </div>
          <div className="text-sm font-bold leading-relaxed text-ink">
            {t('plannedDetail.waitingConfirm', { name: order.master?.name })}
          </div>
          <div className="mt-1 text-xs font-semibold text-ink-soft">
            {t('plannedDetail.waitingConfirmHint')} · {mm}:{String(ss).padStart(2, '0')}
          </div>
        </div>
      )}

      {confirmed && (
        <>
          <Alert tone="success">{t('plannedDetail.confirmed', { name: order.master?.name })}</Alert>
          <Card padding="sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-fill text-sm font-extrabold text-ink">
                {order.master?.name?.slice(0, 2).toUpperCase() ?? '—'}
              </div>
              <div className="flex flex-1 items-center gap-1 text-sm font-extrabold text-ink">
                {order.master?.name}
                <CheckIcon size={14} className="shrink-0 text-success" title={t('orderDetail.verified')} />
              </div>
              {order.master?.phone && (
                /* Остаётся ссылкой tel:, а не IconButton: набор номера — задача
                   браузера/ОС. Размер и вид совпадают с IconButton variant="primary". */
                <a
                  href={`tel:${order.master.phone}`}
                  aria-label={t('orderDetail.callMaster')}
                  title={t('orderDetail.callMaster')}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary"
                >
                  <PhoneIcon size={20} />
                </a>
              )}
            </div>
            <div className="my-2.5 border-t border-fill-soft" />
            <div className="flex justify-between text-xs font-bold">
              <span className="text-ink-soft">{t('plannedDetail.workLabel')}</span>
              <span className="text-ink">{price} ₸</span>
            </div>
            <div className="mt-1 flex justify-between text-xs font-bold">
              <span className="text-ink-soft">{t('plannedDetail.whenLabel')}</span>
              <span className="text-ink">{new Date(order.slotStart).toLocaleString('ru-RU', { weekday: 'short', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </Card>
        </>
      )}

      <div className="rounded-md bg-fill px-3.5 py-2.5 text-xs font-semibold text-ink">
        {order.category?.name} · «{order.description.slice(0, 40)}» · {order.address}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <Button variant="danger" fullWidth onClick={cancel}>
        {t('plannedDetail.cancel')}
      </Button>
    </div>
  );
}
