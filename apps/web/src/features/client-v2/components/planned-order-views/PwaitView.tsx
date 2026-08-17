import { useState } from 'react';
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
  Spinner,
  StarIcon,
} from '@masterqala/ui';
import { api } from '../../../../api';
import { categoryMeta } from '../../categoryMeta';
import SelectBidConfirm from './SelectBidConfirm';
import type { PlannedOrderDetail, PlannedBid } from '../../pages/PlannedOrderPage';

export default function PwaitView({
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
  const [selected, setSelected] = useState<PlannedBid | null>(null);
  const [error, setError] = useState('');

  async function cancel() {
    setError('');
    try {
      await api(`/planned-orders/${orderId}/cancel`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (selected) {
    return <SelectBidConfirm plannedOrderId={orderId} bid={selected} onBack={() => setSelected(null)} />;
  }

  const cheapestId = order.bids.length ? order.bids.reduce((a, b) => (b.price < a.price ? b : a)).id : null;
  const slotDate = new Date(order.slotStart);
  const when = `${slotDate.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })}`;

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <IconButton label={t('common.back')} icon={<ArrowLeftIcon />} onClick={() => navigate('/')} className="-ml-2.5" />
        <span className="flex-1 truncate text-base font-extrabold text-ink">{order.category?.name}</span>
        <Badge tone="primary">{t('plannedDetail.publishedBadge')}</Badge>
      </div>
      {/* Иконка категории — SVG, поэтому строка выравнивается по базовой линии
          через inline-flex, а не пробелом после эмодзи. */}
      <div className="inline-flex items-center gap-1.5 rounded-md bg-fill px-3.5 py-2.5 text-xs font-semibold text-ink">
        <span className="shrink-0 text-ink-soft">{categoryMeta(order.category?.slug ?? '').icon}</span>
        <span>
          {order.category?.name} · {when} · {order.district}
          {order.budget && ` · ~${order.budget} ₸`}
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-extrabold text-ink">
          {t('plannedDetail.offersCount', { n: order.bids.length })}
        </span>
      </div>
      {order.bids.length === 0 && (
        <div className="rounded-lg border-[1.5px] border-dashed border-border bg-surface p-5.5 text-center">
          <div className="mb-2.5 flex justify-center text-primary">
            <Spinner size={24} />
          </div>
          <div className="whitespace-pre-line text-xs font-bold leading-relaxed text-ink-soft">
            {t('plannedDetail.noBidsYet')}
          </div>
        </div>
      )}
      {order.bids.map((b) => (
        <Card key={b.id} padding="sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fill text-xs font-extrabold text-ink">
                {b.master.name?.slice(0, 2).toUpperCase() ?? '—'}
              </div>
              <div>
                <div className="flex items-center gap-1 text-sm font-extrabold text-ink">
                  {b.master.name}
                  <CheckIcon size={14} className="shrink-0 text-success" title={t('orderDetail.verified')} />
                </div>
                <div className="flex items-center gap-1 text-2xs font-semibold text-ink-soft">
                  <StarIcon size={13} className="shrink-0 text-warning" />
                  {b.master.rating?.toFixed(1) ?? '—'} · {t('plannedDetail.ordersShort', { n: b.master.completedCount })} ·{' '}
                  {b.master.experienceYears} лет
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-extrabold text-primary">{b.price} ₸</div>
              <div className="text-2xs font-semibold text-ink-soft">{t('plannedDetail.termLabel', { term: b.term })}</div>
            </div>
          </div>
          {b.comment && <div className="my-2 text-xs leading-snug text-on-fill">«{b.comment}»</div>}
          <div className="flex items-center gap-1.5">
            {b.id === cheapestId && <Badge tone="success">{t('plannedDetail.bestPrice')}</Badge>}
            <Button className="ml-auto" onClick={() => setSelected(b)}>
              {t('plannedDetail.select')}
            </Button>
          </div>
        </Card>
      ))}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          fullWidth
          disabled={order.bids.length === 0}
          onClick={() => navigate(`/planned/${orderId}/compare`)}
        >
          {t('plannedDetail.compare', { n: order.bids.length })}
        </Button>
        <Button variant="danger" fullWidth onClick={cancel}>
          {t('plannedDetail.cancel')}
        </Button>
      </div>
    </div>
  );
}
