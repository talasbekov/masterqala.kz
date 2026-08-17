import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card } from '@masterqala/ui';
import { api } from '../../../../api';
import type { OrderDetail } from '../../pages/OrderPage';

export default function DoneView({ order, orderId, onChanged }: { order: OrderDetail; orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const paymentsEnabled = order.commercialMode !== 'FREE_PILOT' && order.freePilot !== true;
  const navigate = useNavigate();
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
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-ink">{t('orderDetail.doneTitle')}</div>
      <Card padding="sm">
        <div className="mb-2.5 text-sm font-extrabold text-ink">{order.master?.name}</div>
        {paymentsEnabled && (
          <div className="flex justify-between text-sm font-semibold text-ink-soft">
            <span>{t('orderDetail.doneCalloutLabel')}</span>
            <span>{order.calloutPrice} ₸</span>
          </div>
        )}
        <div className={`${paymentsEnabled ? 'mt-1' : ''} flex justify-between text-sm font-semibold text-ink-soft`}>
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
      <Button variant="success" fullWidth onClick={confirmDone}>
        {t('orderDetail.confirmDone')}
      </Button>
      <Button variant="secondary" fullWidth onClick={() => navigate(`/order/${orderId}/dispute`)}>
        {t('orderDetail.openDispute')}
      </Button>
    </div>
  );
}
