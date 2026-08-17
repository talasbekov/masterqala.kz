import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card } from '@masterqala/ui';
import { api } from '../../../../api';
import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PlannedDoneView({
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
  const [error, setError] = useState('');

  async function confirmDone() {
    setError('');
    try {
      await api(`/planned-orders/${orderId}/confirm-completion`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-ink">{t('plannedDetail.doneTitle')}</div>
      <Card padding="sm">
        <div className="mb-1.5 text-sm font-extrabold text-ink">{order.master?.name}</div>
        <div className="flex justify-between text-base font-extrabold text-ink">
          <span className="text-ink-soft">{t('plannedDetail.workLabel')}</span>
          <span>{order.workPrice} ₸</span>
        </div>
      </Card>
      <p className="text-xs leading-relaxed text-ink-soft">{t('plannedDetail.doneNote')}</p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <Button variant="success" fullWidth onClick={confirmDone}>
        {t('plannedDetail.confirmDone')}
      </Button>
      <Button variant="secondary" fullWidth onClick={() => navigate(`/planned/${orderId}/dispute`)}>
        {t('plannedDetail.openDispute')}
      </Button>
    </div>
  );
}
