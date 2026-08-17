'use client';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Input, PhoneIcon } from '@masterqala/ui';
import type { BadgeTone } from '@masterqala/ui';
import MapView from './MapView';
import { useMasterPresence } from '@/lib/masterPresence';
import {
  cancelOrder,
  completeOrder,
  proposePrice,
  setOnSite,
  setOnWay,
  type ActiveOrder,
} from '@/lib/activeOrder';

const FALLBACK_CENTER = { lat: 43.2389, lng: 76.8897 };

const STATUS_LABELS: Record<string, string> = {
  ACCEPTED: 'Принята',
  MASTER_ON_WAY: 'В пути',
  INSPECTION: 'Осмотр',
  AWAITING_PRICE_CONFIRM: 'Ждём подтверждения цены',
  IN_PROGRESS: 'В работе',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  ACCEPTED: 'primary',
  MASTER_ON_WAY: 'primary',
  INSPECTION: 'warning',
  AWAITING_PRICE_CONFIRM: 'warning',
  IN_PROGRESS: 'success',
};

export function ActiveOrderView({ order, onChanged }: { order: ActiveOrder; onChanged: () => void }) {
  const { myPosition } = useMasterPresence();
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const center = order.lat != null && order.lng != null ? { lat: order.lat, lng: order.lng } : FALLBACK_CENTER;

  async function run(action: () => Promise<void>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError('');
    setSubmitting(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* Мобильный порядок: карта сверху фиксированной высотой, управление —
       под большим пальцем. От md карта занимает всё свободное место слева. */
    <div className="flex min-h-screen flex-col md:h-screen md:min-h-0 md:flex-row">
      <MapView
        mode="tracking"
        center={center}
        masterPosition={myPosition}
        height={null}
        className="h-56 shrink-0 rounded-none sm:h-72 md:h-full md:flex-1"
      />
      <div className="flex-1 space-y-4 overflow-y-auto border-border bg-surface p-4 md:w-96 md:flex-none md:border-l md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-extrabold text-ink">{order.category?.name}</h1>
          {STATUS_LABELS[order.status] && (
            <Badge tone={STATUS_TONES[order.status] ?? 'neutral'}>{STATUS_LABELS[order.status]}</Badge>
          )}
        </div>

        <Card className="space-y-1">
          <p className="text-sm text-ink">{order.address}</p>
          <p className="text-sm text-ink-soft">{order.description}</p>
          {order.client?.phone && (
            <a
              href={`tel:${order.client.phone}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary underline"
            >
              <PhoneIcon size={18} />
              {order.client.phone}
            </a>
          )}
        </Card>

        {error && <Alert tone="danger">{error}</Alert>}

        {order.status === 'ACCEPTED' && (
          <Button fullWidth loading={submitting} loadingLabel="Отправляем…" onClick={() => run(() => setOnWay(order.id))}>
            Еду
          </Button>
        )}
        {order.status === 'MASTER_ON_WAY' && (
          <Button fullWidth loading={submitting} loadingLabel="Отправляем…" onClick={() => run(() => setOnSite(order.id))}>
            На месте
          </Button>
        )}
        {order.status === 'INSPECTION' && (
          <div className="space-y-3">
            <Input
              label="Стоимость работ, ₸"
              type="number"
              min="1"
              inputMode="numeric"
              placeholder="Например, 12000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Input
              label="Комментарий"
              hint="Необязательно"
              placeholder="Что именно нужно сделать"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              fullWidth
              loading={submitting}
              loadingLabel="Отправляем…"
              disabled={!Number(price)}
              onClick={() => run(() => proposePrice(order.id, Number(price), comment))}
            >
              Отправить цену
            </Button>
          </div>
        )}
        {order.status === 'AWAITING_PRICE_CONFIRM' && (
          <Alert tone="info">Ожидание подтверждения цены клиентом…</Alert>
        )}
        {order.status === 'IN_PROGRESS' && (
          <Button
            fullWidth
            variant="success"
            loading={submitting}
            loadingLabel="Отправляем…"
            onClick={() => run(() => completeOrder(order.id))}
          >
            Выполнено
          </Button>
        )}
        {(order.status === 'ACCEPTED' || order.status === 'MASTER_ON_WAY') && (
          <Button
            fullWidth
            variant="danger"
            loading={submitting}
            loadingLabel="Отменяем…"
            onClick={() =>
              run(() => cancelOrder(order.id), 'Отменить заявку? Заявка вернётся в поиск, отмены фиксируются.')
            }
          >
            Отменить
          </Button>
        )}
      </div>
    </div>
  );
}
