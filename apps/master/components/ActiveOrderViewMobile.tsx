'use client';
import { useState } from 'react';
import MapView from './MapView';
import { ConfirmSheet } from './ConfirmSheet';
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

const DURATION_CHIPS = [
  { key: 'short', label: '~1 час' },
  { key: 'medium', label: '2–3 часа' },
  { key: 'long', label: 'полдня' },
] as const;

type DurationKey = (typeof DURATION_CHIPS)[number]['key'];

type ConfirmKind = 'onway' | 'onsite' | 'complete' | 'cancel' | null;

const CONFIRM_COPY: Record<Exclude<ConfirmKind, null>, { title: string; body: string; confirmLabel: string; danger?: boolean }> = {
  onway: {
    title: 'Едете к клиенту?',
    body: 'Клиент увидит, что вы выехали. Дальше — отметьте «На месте», когда доберётесь.',
    confirmLabel: 'Еду',
  },
  onsite: {
    title: 'Вы на месте?',
    body: 'Клиент получит уведомление, что вы на месте. Дальше — осмотр и отправка цены.',
    confirmLabel: 'Я на месте',
  },
  complete: {
    title: 'Работа выполнена?',
    body: 'Клиент получит запрос на подтверждение. Без ответа заявка закроется автоматически через 24 часа, оплата поступит в кошелёк после подтверждения или автозакрытия.',
    confirmLabel: 'Выполнено',
  },
  cancel: {
    title: 'Отменить заявку?',
    body: 'Спишется 2 кредита, приоритет в подборе снизится на 24 часа. После 3-й отмены за 30 дней аккаунт блокируется на 7 дней.',
    confirmLabel: 'Отменить заявку',
    danger: true,
  },
};

export function ActiveOrderViewMobile({ order, onChanged }: { order: ActiveOrder; onChanged: () => void }) {
  const { myPosition } = useMasterPresence();
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [duration, setDuration] = useState<DurationKey | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);

  const center = order.lat != null && order.lng != null ? { lat: order.lat, lng: order.lng } : FALLBACK_CENTER;
  const compensation = order.calloutPrice - order.serviceFee;

  async function run(action: () => Promise<void>) {
    setError('');
    setSubmitting(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
      setConfirmKind(null);
    }
  }

  function confirmedAction(kind: Exclude<ConfirmKind, null>) {
    if (kind === 'onway') return () => run(() => setOnWay(order.id));
    if (kind === 'onsite') return () => run(() => setOnSite(order.id));
    if (kind === 'complete') return () => run(() => completeOrder(order.id));
    return () => run(() => cancelOrder(order.id));
  }

  function sendPrice() {
    const amount = Number(price);
    if (!amount) return;
    const durationLabel = duration ? DURATION_CHIPS.find((c) => c.key === duration)?.label : null;
    const fullComment = durationLabel ? `${comment}${comment ? '\n' : ''}Ориентировочно: ${durationLabel}.` : comment;
    run(() => proposePrice(order.id, amount, fullComment || undefined));
  }

  const addressLine = [order.entrance && `подъезд ${order.entrance}`, order.floor && `этаж ${order.floor}`, order.apartment && `кв. ${order.apartment}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex h-full flex-col md:hidden">
      <MapView mode="tracking" center={center} masterPosition={myPosition} height={undefined} className="flex-1 rounded-none" />
      <div className="max-h-[65vh] overflow-y-auto rounded-t-sheet bg-surface px-5 pb-4 pt-3.5 shadow-sheet">
        <div className="mx-auto mb-2.5 h-1 w-9.5 rounded-full bg-border" />

        <h2 className="text-base font-extrabold text-ink">{order.category?.name}</h2>

        <div className="mt-2 rounded-lg border border-border p-3.5">
          <div className="text-sm font-extrabold text-ink">{order.address}</div>
          {addressLine && <div className="mt-0.5 text-xs font-semibold text-ink-soft">{addressLine}</div>}
          {order.addressComment && <div className="mt-0.5 text-xs text-ink-soft">{order.addressComment}</div>}
          <div className="my-2.5 border-t border-border" />
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-extrabold text-ink">
              {order.client?.name?.slice(0, 1).toUpperCase() ?? '—'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-ink">{order.client?.name}</div>
              <div className="text-xs text-ink-soft">клиент</div>
            </div>
            {order.client?.phone && (
              <a
                href={`tel:${order.client.phone}`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-base text-white"
              >
                📞
              </a>
            )}
          </div>
        </div>

        <div className="mt-2.5 rounded-lg bg-fill p-3 text-xs font-semibold leading-relaxed text-ink">
          {order.description}
          {order.photos.length > 0 && ` · ${order.photos.length} фото`}
          {order.status !== 'INSPECTION' && order.status !== 'AWAITING_PRICE_CONFIRM' && order.status !== 'IN_PROGRESS' && (
            <>
              {' · '}
              {order.freePilot ? 'бесплатный пилот' : (
                <>
                  Вам за выезд: <b>{compensation} ₸</b>
                </>
              )}
            </>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        <div className="mt-3">
          {order.status === 'ACCEPTED' && (
            <button
              disabled={submitting}
              className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
              onClick={() => setConfirmKind('onway')}
            >
              Еду
            </button>
          )}
          {order.status === 'MASTER_ON_WAY' && (
            <button
              disabled={submitting}
              className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
              onClick={() => setConfirmKind('onsite')}
            >
              На месте
            </button>
          )}
          {order.status === 'INSPECTION' && (
            <div className="space-y-3 rounded-lg border-2 border-primary p-4">
              <div>
                <div className="mb-1 text-[11px] font-bold text-ink-soft">Работы</div>
                <input
                  type="number"
                  min="1"
                  placeholder="Стоимость работ, ₸"
                  className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1 text-[13.5px] font-extrabold text-ink">
                  Что входит <span className="text-[11.5px] font-semibold text-ink-soft">(увидит клиент)</span>
                </div>
                <textarea
                  placeholder="Замена сифона и прокладки, детали есть с собой"
                  className="w-full resize-none rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1.5 text-[13.5px] font-extrabold text-ink">Длительность</div>
                <div className="flex gap-1.5">
                  {DURATION_CHIPS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setDuration(duration === c.key ? null : c.key)}
                      className={`rounded-pill px-3.5 py-1.5 text-xs font-extrabold ${
                        duration === c.key ? 'bg-primary text-white' : 'border-[1.5px] border-border text-ink-soft'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              {Number(price) > 0 && (
                <div className="rounded-lg bg-fill p-3 text-xs font-semibold leading-relaxed text-ink">
                  {order.freePilot
                    ? 'Бесплатный пилот — сумма согласовывается с клиентом напрямую.'
                    : (
                      <>
                        Клиент увидит: выезд {order.calloutPrice} ₸ + работы {Number(price)} ₸ = <b>{order.calloutPrice + Number(price)} ₸</b>. На решение у клиента 15 минут.
                      </>
                    )}
                </div>
              )}
              <button
                disabled={submitting || !Number(price)}
                className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
                onClick={sendPrice}
              >
                Отправить клиенту
              </button>
            </div>
          )}
          {order.status === 'AWAITING_PRICE_CONFIRM' && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm font-semibold text-ink-soft">
              Клиент рассматривает цену…
            </p>
          )}
          {order.status === 'IN_PROGRESS' && (
            <button
              disabled={submitting}
              className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
              onClick={() => setConfirmKind('complete')}
            >
              Выполнено
            </button>
          )}
          {(order.status === 'ACCEPTED' || order.status === 'MASTER_ON_WAY') && (
            <button
              disabled={submitting}
              className="mt-2 w-full rounded-pill border-[1.5px] border-danger p-3 text-sm font-extrabold text-danger disabled:opacity-40"
              onClick={() => setConfirmKind('cancel')}
            >
              Отменить
            </button>
          )}
        </div>
      </div>

      {confirmKind && (
        <ConfirmSheet
          open
          busy={submitting}
          title={CONFIRM_COPY[confirmKind].title}
          body={CONFIRM_COPY[confirmKind].body}
          confirmLabel={CONFIRM_COPY[confirmKind].confirmLabel}
          danger={CONFIRM_COPY[confirmKind].danger}
          onConfirm={confirmedAction(confirmKind)}
          onClose={() => setConfirmKind(null)}
        />
      )}
    </div>
  );
}
