'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
  const [selected, setSelected] = useState<PlannedOrderDetail | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [bidTerm, setBidTerm] = useState('');
  const [bidComment, setBidComment] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchPlannedFeed()
      .then(setFeed)
      .catch((e) => setError((e as Error).message));
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
    try {
      setSelected(await fetchPlannedOrder(id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit() {
    if (!selected || !Number(bidPrice) || !bidTerm) return;
    setError('');
    try {
      await submitBid(selected.id, { price: Number(bidPrice), term: bidTerm, comment: bidComment });
      setSelected(null);
      setBidPrice('');
      setBidTerm('');
      setBidComment('');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const hasFreeOrders = feed.some((item) => item.commercialMode === 'FREE_PILOT');
  const hasPaidOrders = feed.some((item) => item.commercialMode !== 'FREE_PILOT');
  const selectedFree = selected ? selected.commercialMode === 'FREE_PILOT' : false;

  if (selected) {
    return (
      <div className="mx-auto max-w-[560px] space-y-3 p-8">
        <button className="text-sm text-ink-soft" onClick={() => setSelected(null)}>
          ← Назад к ленте
        </button>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold text-ink">{selected.category?.name}</h2>
          <span className="rounded-pill bg-fill-soft px-2.5 py-1 text-xs font-extrabold text-primary">
            {selectedFree ? 'Бесплатный отклик' : 'Отклик: 1 кредит'}
          </span>
        </div>
        <div className="text-sm text-ink-soft">{selected.district}</div>
        <div className="text-sm text-ink-soft">{new Date(selected.slotStart).toLocaleString('ru-RU')}</div>
        <div className="text-sm text-ink">{selected.description}</div>
        <input
          type="number"
          min="1"
          placeholder="Ваша цена, ₸"
          className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={bidPrice}
          onChange={(e) => setBidPrice(e.target.value)}
        />
        <input
          placeholder="Срок (например: сегодня до 18:00)"
          className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={bidTerm}
          onChange={(e) => setBidTerm(e.target.value)}
        />
        <input
          placeholder="Комментарий (необязательно)"
          className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={bidComment}
          onChange={(e) => setBidComment(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
          disabled={!Number(bidPrice) || !bidTerm}
          onClick={submit}
        >
          {selectedFree ? 'Откликнуться бесплатно' : 'Откликнуться (1 кредит)'}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] space-y-3 p-8">
      {(leadCreditsEnabled || hasPaidOrders) && (
        <Link href="/lead-credits" className="block text-center text-sm font-bold text-primary underline">
          Баланс кредитов — нужен для платных заявок
        </Link>
      )}
      {(!leadCreditsEnabled || hasFreeOrders) && (
        <div className="rounded-md bg-fill-soft p-3 text-center text-sm font-semibold text-ink">
          Заявки с отметкой «Бесплатно» не расходуют lead-кредиты.
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {feed.length === 0 && <p className="text-center text-sm text-ink-soft">Пока нет заявок в ваших категориях</p>}
      {feed.map((item) => {
        const free = item.commercialMode === 'FREE_PILOT';
        return (
          <button
            key={item.id}
            onClick={() => open(item.id)}
            className="block w-full rounded-lg border border-border bg-surface p-4 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-extrabold text-ink">{item.category?.name}</span>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-ink-soft">{item._count.bids}/5 ставок</span>
                <span className="rounded-pill bg-fill-soft px-2 py-0.5 text-xs font-extrabold text-primary">
                  {free ? 'Бесплатно' : '1 кредит'}
                </span>
              </div>
            </div>
            <div className="text-sm text-ink-soft">{item.district}</div>
            <div className="text-sm text-ink-soft">{new Date(item.slotStart).toLocaleString('ru-RU')}</div>
          </button>
        );
      })}
    </div>
  );
}
