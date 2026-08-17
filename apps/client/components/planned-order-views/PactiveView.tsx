'use client';
import { useEffect, useState } from 'react';
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
  PhoneIcon,
  Spinner,
} from '@masterqala/ui';
import { api } from '@/lib/api';
import { PLANNED_STATUS_LABELS } from '@/lib/orderStatus';
import type { PlannedOrderDetail } from '@/lib/plannedOrderTypes';

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
  const router = useRouter();
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      <div className="flex items-center gap-2.5">
        <IconButton label={t('common.back')} icon={<ArrowLeftIcon size={20} />} onClick={() => router.push('/')} />
        <h1 className="flex-1 truncate text-base font-extrabold text-ink">{order.category?.name}</h1>
        <Badge tone="primary">{PLANNED_STATUS_LABELS[order.status]}</Badge>
      </div>

      {!confirmed && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-center">
          <Spinner size={24} className="mx-auto mb-2.5 text-primary" label={t('common.loading')} />
          <p className="text-xs leading-relaxed font-bold text-ink">
            {t('plannedDetail.waitingConfirm', { name: order.master?.name })}
          </p>
          <p className="mt-1 text-xs font-semibold text-ink-soft">
            {t('plannedDetail.waitingConfirmHint')} · {mm}:{String(ss).padStart(2, '0')}
          </p>
        </div>
      )}

      {confirmed && (
        <>
          <Alert tone="success">{t('plannedDetail.confirmed', { name: order.master?.name })}</Alert>
          <Card>
            <div className="flex items-center gap-2.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-sm font-extrabold text-ink">
                {order.master?.name?.slice(0, 2).toUpperCase() ?? '—'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-ink">
                  {order.master?.name}
                  <Badge tone="success" icon={<CheckIcon size={14} />}>
                    {t('orderDetail.verified')}
                  </Badge>
                </p>
              </div>
              {order.master?.phone && (
                <a
                  href={`tel:${order.master.phone}`}
                  aria-label={t('orderDetail.callMaster')}
                  title={t('orderDetail.callMaster')}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-primary-hover"
                >
                  <PhoneIcon size={20} />
                </a>
              )}
            </div>
            <div className="my-2.5 border-t border-border" />
            <div className="flex justify-between gap-2 text-xs font-bold">
              <span className="text-ink-soft">{t('plannedDetail.workLabel')}</span>
              <span className="text-ink">{price} ₸</span>
            </div>
            <div className="mt-1 flex justify-between gap-2 text-xs font-bold">
              <span className="text-ink-soft">{t('plannedDetail.whenLabel')}</span>
              <span className="text-right text-ink">
                {new Date(order.slotStart).toLocaleString('ru-RU', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </Card>
        </>
      )}

      <p className="rounded-md bg-surface-sunken px-3.5 py-2.5 text-xs font-semibold text-on-fill">
        {order.category?.name} · «{order.description.slice(0, 40)}» · {order.address}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <Button variant="secondary" fullWidth onClick={cancel}>
        {t('plannedDetail.cancel')}
      </Button>
    </div>
  );
}
