'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';
import {
  fetchPlannedFeed,
  fetchPlannedOrder,
  submitBid,
  type PlannedFeedItem,
  type PlannedOrderDetail,
} from '@/lib/plannedFeed';

const MAX_BIDS = 5;

function formatSlot(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = start.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  const startTime = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${startTime}–${endTime}`;
}

export function PlannedFeedView() {
  const { leadCreditsEnabled } = useCommercialMode();
  const [feed, setFeed] = useState<PlannedFeedItem[]>([]);
  const [selected, setSelected] = useState<PlannedOrderDetail | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [bidTerm, setBidTerm] = useState('');
  const [bidComment, setBidComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  async function open(item: PlannedFeedItem) {
    if (item._count.bids >= MAX_BIDS) return;
    setError('');
    setBalance(null);
    try {
      const detail = await fetchPlannedOrder(item.id);
      setSelected(detail);
      if (detail.commercialMode !== 'FREE_PILOT' && leadCreditsEnabled) {
        api('/lead-credits/balance')
          .then((r) => setBalance(r.balance))
          .catch(() => setBalance(null));
      }
    } catch (e) {
      setError((e as Error).message);
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

  if (selected) {
    const free = selected.commercialMode === 'FREE_PILOT';
    const creditsGated = !free && leadCreditsEnabled;
    const creditsLow = creditsGated && balance !== null && balance < 1;
    const creditsKnown = !creditsGated || balance !== null;

    return (
      <div className="mx-auto max-w-[560px] space-y-3 p-4 md:p-8">
        <button className="text-sm font-bold text-primary" onClick={() => setSelected(null)}>
          ← Назад к ленте
        </button>
        <div className="rounded-lg bg-fill-soft p-3 text-sm font-semibold text-ink">
          {selected.category?.name} · {selected.district} · {formatSlot(selected.slotStart, selected.slotEnd)}
          {' · без точного адреса до выбора'}
        </div>
        <div className="text-sm text-ink">{selected.description}</div>
        {selected.budget != null && (
          <div className="text-sm text-ink-soft">Бюджет клиента: ~{selected.budget} ₸</div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border-[1.5px] border-primary p-3">
            <div className="text-[11px] font-bold text-ink-soft">Цена, ₸</div>
            <input
              type="number"
              min="1"
              placeholder="0"
              className="w-full bg-transparent text-base font-extrabold text-ink outline-none"
              value={bidPrice}
              onChange={(e) => setBidPrice(e.target.value)}
            />
          </div>
          <div className="rounded-lg border-[1.5px] border-border p-3">
            <div className="text-[11px] font-bold text-ink-soft">Срок</div>
            <input
              placeholder="напр. сегодня до 18:00"
              className="w-full bg-transparent text-base font-extrabold text-ink outline-none placeholder:text-xs placeholder:font-semibold placeholder:text-muted"
              value={bidTerm}
              onChange={(e) => setBidTerm(e.target.value)}
            />
          </div>
        </div>

        <textarea
          placeholder="Комментарий для клиента (необязательно)"
          rows={3}
          className="w-full resize-none rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={bidComment}
          onChange={(e) => setBidComment(e.target.value)}
        />

        {creditsGated && creditsKnown && !creditsLow && (
          <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm font-bold text-ink">
            <span>Спишется: 1 ⬡</span>
            <span className="text-ink-soft">останется: {(balance ?? 1) - 1}</span>
          </div>
        )}
        {creditsGated && creditsLow && (
          <>
            <div className="rounded-lg bg-danger-bg p-3 text-sm font-semibold leading-relaxed text-danger">
              Недостаточно кредитов (баланс: {balance}). Купите пакет — вернём вас в эту форму.
            </div>
            <Link
              href="/lead-credits"
              className="block w-full rounded-pill bg-primary p-3.5 text-center text-sm font-extrabold text-white"
            >
              Купить кредиты
            </Link>
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {!creditsLow && (
          <button
            className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
            disabled={submitting || !Number(bidPrice) || !bidTerm || (creditsGated && !creditsKnown)}
            onClick={submit}
          >
            {free ? 'Откликнуться бесплатно' : 'Откликнуться · −1 ⬡'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] space-y-3 p-4 md:p-8">
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
        const full = item._count.bids >= MAX_BIDS;
        return (
          <button
            key={item.id}
            disabled={full}
            onClick={() => open(item)}
            className={`block w-full rounded-lg border border-border bg-surface p-4 text-left ${full ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-extrabold text-ink">{item.category?.name}</span>
              <span
                className={`rounded-pill px-2 py-0.5 text-xs font-extrabold ${
                  full ? 'bg-danger-bg text-danger' : 'bg-fill-soft text-primary'
                }`}
              >
                {item._count.bids}/{MAX_BIDS} ставок
              </span>
            </div>
            <div className="mt-1 text-sm text-ink-soft">{item.district}</div>
            <div className="text-sm text-ink-soft">{formatSlot(item.slotStart, item.slotEnd)}</div>
            {item.budget != null && <div className="text-xs text-ink-soft">бюджет ~{item.budget} ₸</div>}
            {full ? (
              <div className="mt-2 text-xs font-semibold text-ink-soft">Лимит откликов достигнут</div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-pill px-2 py-0.5 text-[11px] font-extrabold ${
                    free ? 'bg-fill-soft text-primary' : 'bg-warning-bg text-warning-ink'
                  }`}
                >
                  {free ? 'Бесплатно' : 'отклик: 1 ⬡'}
                </span>
              </div>
            )}
          </button>
        );
      })}
      {feed.length > 0 && (
        <div className="rounded-md bg-fill-soft p-3 text-xs font-semibold leading-relaxed text-ink">
          Проиграли отклик? Кредит не возвращается. Клиент отменил после выбора вас — кредит вернётся автоматически.
        </div>
      )}
    </div>
  );
}
