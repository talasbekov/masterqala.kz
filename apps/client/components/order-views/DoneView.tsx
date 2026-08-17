'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, CheckIcon, ScaleIcon } from '@masterqala/ui';
import { api } from '@/lib/api';
import type { OrderDetail } from '@/lib/orderTypes';

export default function DoneView({ order, orderId, onChanged }: { order: OrderDetail; orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const paymentsEnabled = order.commercialMode !== 'FREE_PILOT' && order.freePilot !== true;
  const router = useRouter();
  const [error, setError] = useState('');

  async function confirmDone() {
    setError('');
    try {
      await api(`/orders/${orderId}/confirm-completion`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const total = order.calloutPrice + (order.workPrice ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3.5 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      <h1 className="text-lg font-extrabold text-ink">{t('orderDetail.doneTitle')}</h1>
      <Card>
        <p className="mb-2.5 text-sm font-extrabold text-ink">{order.master?.name}</p>
        {paymentsEnabled && (
          <div className="flex justify-between text-xs font-semibold text-ink-soft">
            <span>{t('orderDetail.doneCalloutLabel')}</span>
            <span>{order.calloutPrice} ₸</span>
          </div>
        )}
        <div className={`${paymentsEnabled ? 'mt-1' : ''} flex justify-between text-xs font-semibold text-ink-soft`}>
          <span>{t('orderDetail.doneWorkLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
        <div className="my-2.5 border-t border-dashed border-border" />
        <div className="flex justify-between text-base font-extrabold text-ink">
          <span>{t('orderDetail.doneTotalLabel')}</span>
          <span>{total} ₸</span>
        </div>
      </Card>
      <p className="text-xs leading-relaxed text-ink-soft">
        {paymentsEnabled
          ? t('orderDetail.doneNote')
          : 'Проверьте результат и подтвердите выполнение. Оплата работ производится мастеру напрямую. При проблеме откройте спор.'}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <Button variant="success" size="lg" fullWidth icon={<CheckIcon size={18} />} onClick={confirmDone}>
        {t('orderDetail.confirmDone')}
      </Button>
      <Button
        variant="secondary"
        fullWidth
        icon={<ScaleIcon size={18} />}
        onClick={() => router.push(`/order/${orderId}/dispute`)}
      >
        {t('orderDetail.openDispute')}
      </Button>
    </div>
  );
}
