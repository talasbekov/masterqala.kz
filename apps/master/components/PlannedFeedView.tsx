'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  ArrowLeftIcon,
  Badge,
  Button,
  CalendarIcon,
  Card,
  EmptyState,
  Input,
  MapPinIcon,
  SkeletonList,
} from '@masterqala/ui';
import { getSocket } from '@/lib/socket';
import { useCommercialMode } from '@/lib/commercial-mode';
import {
  fetchPlannedFeed,
  fetchPlannedOrder,
  submitBid,
  type PlannedFeedItem,
  type PlannedOrderDetail,
} from '@/lib/plannedFeed';

export function PlannedFeedView() {
  const { leadCreditsEnabled } = useCommercialMode();
  const [feed, setFeed] = useState<PlannedFeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<PlannedOrderDetail | null>(null);
  const [opening, setOpening] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bidPrice, setBidPrice] = useState('');
  const [bidTerm, setBidTerm] = useState('');
  const [bidComment, setBidComment] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchPlannedFeed()
      .then(setFeed)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = () => load();
    socket.on('bid:closed', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:closed', onUpdate);
      socket.off('planned:status', onUpdate);
    };
  }, [load]);

  async function open(id: string) {
    setError('');
    setOpening(id);
    try {
      setSelected(await fetchPlannedOrder(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening('');
    }
  }

  async function submit() {
    if (!selected || !Number(bidPrice) || !bidTerm) return;
    setError('');
    setSubmitting(true);
    try {
      await submitBid(selected.id, { price: Number(bidPrice), term: bidTerm, comment: bidComment });
      setSelected(null);
      setBidPrice('');
      setBidTerm('');
      setBidComment('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const hasFreeOrders = feed.some((item) => item.commercialMode === 'FREE_PILOT');
  const hasPaidOrders = feed.some((item) => item.commercialMode !== 'FREE_PILOT');
  const selectedFree = selected ? selected.commercialMode === 'FREE_PILOT' : false;

  if (selected) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-3 p-4 sm:p-6 md:p-8">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeftIcon size={18} />}
          onClick={() => setSelected(null)}
          className="-ml-3"
        >
          Назад к ленте
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-lg font-extrabold text-ink">{selected.category?.name}</h1>
          <Badge tone={selectedFree ? 'success' : 'primary'}>
            {selectedFree ? 'Бесплатный отклик' : 'Отклик: 1 кредит'}
          </Badge>
        </div>

        <Card className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm text-ink-soft">
            <MapPinIcon size={16} className="shrink-0" />
            {selected.district}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-ink-soft">
            <CalendarIcon size={16} className="shrink-0" />
            {new Date(selected.slotStart).toLocaleString('ru-RU')}
          </p>
          <p className="text-sm text-ink">{selected.description}</p>
        </Card>

        <Input
          label="Ваша цена, ₸"
          type="number"
          min="1"
          inputMode="numeric"
          placeholder="Например, 12000"
          value={bidPrice}
          onChange={(e) => setBidPrice(e.target.value)}
        />
        <Input
          label="Срок"
          hint="Например: сегодня до 18:00"
          value={bidTerm}
          onChange={(e) => setBidTerm(e.target.value)}
        />
        <Input
          label="Комментарий"
          hint="Необязательно"
          value={bidComment}
          onChange={(e) => setBidComment(e.target.value)}
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button
          fullWidth
          loading={submitting}
          loadingLabel="Отправляем отклик…"
          disabled={!Number(bidPrice) || !bidTerm}
          onClick={submit}
        >
          {selectedFree ? 'Откликнуться бесплатно' : 'Откликнуться (1 кредит)'}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 p-4 sm:p-6 md:p-8">
      {(leadCreditsEnabled || hasPaidOrders) && (
        <Link
          href="/lead-credits"
          className="flex min-h-11 items-center justify-center text-center text-sm font-bold text-primary underline"
        >
          Баланс кредитов — нужен для платных заявок
        </Link>
      )}
      {(!leadCreditsEnabled || hasFreeOrders) && (
        <Alert tone="info">Заявки с отметкой «Бесплатно» не расходуют lead-кредиты.</Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      {!loaded ? (
        <SkeletonList rows={3} label="Загружаем плановые заявки" />
      ) : feed.length === 0 ? (
        <EmptyState
          title="Пока нет заявок в ваших категориях"
          subtitle="Новые плановые заявки появятся здесь автоматически."
        />
      ) : (
        <ul className="space-y-3">
          {feed.map((item) => {
            const free = item.commercialMode === 'FREE_PILOT';
            return (
              <Card as="li" key={item.id} padding="none">
                <button
                  type="button"
                  disabled={opening === item.id}
                  onClick={() => open(item.id)}
                  className="block w-full rounded-lg p-4 text-left transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-fill-faint disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-extrabold text-ink">{item.category?.name}</span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="text-xs text-ink-soft">{item._count.bids}/5 ставок</span>
                      <Badge tone={free ? 'success' : 'primary'}>{free ? 'Бесплатно' : '1 кредит'}</Badge>
                    </span>
                  </div>
                  <span className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                    <MapPinIcon size={16} className="shrink-0" />
                    {item.district}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-ink-soft">
                    <CalendarIcon size={16} className="shrink-0" />
                    {new Date(item.slotStart).toLocaleString('ru-RU')}
                  </span>
                </button>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
