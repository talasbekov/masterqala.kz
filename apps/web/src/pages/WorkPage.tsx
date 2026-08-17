import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  ArrowLeftIcon,
  Badge,
  BoltIcon,
  Button,
  CalendarIcon,
  Card,
  EmptyState,
  Input,
  MapPinIcon,
  PhoneIcon,
  SkeletonList,
} from '@masterqala/ui';
import { api } from '../api';
import { useCommercialMode } from '../commercial-mode';
import { getSocket } from '../socket';

type CommercialMode = 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE';

interface UrgentOffer {
  orderId: string;
  category: string;
  description: string;
  address?: string;
  distanceKm: number;
  compensation: number;
  freePilot: boolean;
  deadline: string;
}

interface UrgentOrder {
  id: string;
  status: string;
  address: string;
  description: string;
  category?: { name: string };
  client?: { phone: string };
}

interface PlannedFeedItem {
  id: string;
  commercialMode: CommercialMode;
  category?: { name: string };
  district: string;
  description: string;
  slotStart: string;
  slotEnd: string;
  _count: { bids: number };
}

interface PlannedOrderDetail extends PlannedFeedItem {
  budget?: number | null;
}

function beepAndVibrate() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Звук недоступен — вибрация остаётся резервным уведомлением.
  }
  navigator.vibrate?.([200, 100, 200]);
}

function useCountdown(deadline: string | null): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline]);
  return left;
}

export default function WorkPage() {
  const { leadCreditsEnabled } = useCommercialMode();
  const [online, setOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [offer, setOffer] = useState<UrgentOffer | null>(null);
  const [offerNote, setOfferNote] = useState('');
  const [order, setOrder] = useState<UrgentOrder | null>(null);
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'urgent' | 'planned'>('urgent');
  const [feed, setFeed] = useState<PlannedFeedItem[]>([]);
  const [feedLoaded, setFeedLoaded] = useState(false);
  const [plannedOrder, setPlannedOrder] = useState<PlannedOrderDetail | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [bidTerm, setBidTerm] = useState('');
  const [bidComment, setBidComment] = useState('');
  const [plannedError, setPlannedError] = useState('');
  const geoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsLeft = useCountdown(offer?.deadline ?? null);

  const loadFeed = useCallback(() => {
    api('/planned-orders/feed')
      .then((items) => setFeed(items as PlannedFeedItem[]))
      .catch((e) => setPlannedError((e as Error).message))
      .finally(() => setFeedLoaded(true));
  }, []);

  useEffect(() => {
    if (tab !== 'planned') return;
    loadFeed();
    const socket = getSocket();
    const onUpdate = () => loadFeed();
    socket.on('bid:closed', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:closed', onUpdate);
      socket.off('planned:status', onUpdate);
    };
  }, [tab, loadFeed]);

  async function openPlannedOrder(id: string) {
    setPlannedError('');
    try {
      const selected = await api(`/planned-orders/${id}`);
      setPlannedOrder(selected as PlannedOrderDetail);
    } catch (e) {
      setPlannedError((e as Error).message);
    }
  }

  async function submitBid() {
    if (!plannedOrder || !Number(bidPrice) || !bidTerm) return;
    setPlannedError('');
    try {
      await api(`/planned-orders/${plannedOrder.id}/bids`, {
        method: 'POST',
        body: JSON.stringify({ price: Number(bidPrice), term: bidTerm, comment: bidComment || undefined }),
      });
      setPlannedOrder(null);
      setBidPrice('');
      setBidTerm('');
      setBidComment('');
      loadFeed();
    } catch (e) {
      setPlannedError((e as Error).message);
    }
  }

  const loadActive = useCallback(() => {
    api('/master/active-order')
      .then((response) => setOrder((response.order ?? null) as UrgentOrder | null))
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    loadActive();
    const socket = getSocket();
    setConnected(socket.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onOffer = (incoming: UrgentOffer) => {
      setOffer(incoming);
      setOfferNote('');
      beepAndVibrate();
    };
    const onOfferClosed = (payload: { orderId: string; reason: string }) => {
      setOffer((current) => (current?.orderId === payload.orderId ? null : current));
      setOfferNote(payload.reason);
    };
    const onStatus = () => loadActive();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('offer:new', onOffer);
    socket.on('offer:closed', onOfferClosed);
    socket.on('order:status', onStatus);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('offer:new', onOffer);
      socket.off('offer:closed', onOfferClosed);
      socket.off('order:status', onStatus);
      if (geoTimer.current) clearInterval(geoTimer.current);
    };
  }, [loadActive]);

  function goOnline() {
    setGeoDenied(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const socket = getSocket();
        socket.emit('presence:online', { lat: position.coords.latitude, lng: position.coords.longitude });
        setOnline(true);
        geoTimer.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition((next) =>
            socket.emit('geo:update', { lat: next.coords.latitude, lng: next.coords.longitude }),
          );
        }, 30000);
      },
      () => setGeoDenied(true),
    );
  }

  function goOffline() {
    getSocket().emit('presence:offline');
    setOnline(false);
    if (geoTimer.current) clearInterval(geoTimer.current);
  }

  async function acceptOffer() {
    if (!offer) return;
    try {
      await api(`/orders/${offer.orderId}/accept`, { method: 'POST' });
      setOffer(null);
      loadActive();
    } catch (e) {
      setOffer(null);
      setOfferNote((e as Error).message);
    }
  }

  async function action(path: string, body?: object, confirmText?: string) {
    if (!order) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setError('');
    try {
      await api(`/orders/${order.id}/${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      loadActive();
    } catch (e) {
      setError((e as Error).message);
      loadActive();
    }
  }

  if (offer) {
    return (
      /* Срочная заявка — единственное место, где уместен оранжевый: в этой
         системе он означает срочность, а не «ещё один яркий цвет». */
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-title"
        className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4 sm:p-6"
      >
        <Card raised padding="lg" className="w-full max-w-md space-y-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <Badge tone="urgent" icon={<BoltIcon size={14} />}>
              Новая заявка
            </Badge>
            <span className="text-2xs font-extrabold uppercase text-ink-soft">{offer.distanceKm} км</span>
          </div>
          <h1 id="offer-title" className="text-xl font-bold text-ink">
            {offer.category}
          </h1>
          <p className="text-sm text-ink-soft">{offer.description}</p>
          {offer.address && <p className="text-sm text-ink-soft">{offer.address}</p>}
          {offer.freePilot ? (
            <p className="rounded-md bg-fill-soft p-3 text-sm font-semibold text-ink">
              Бесплатный пилот: стоимость работ согласовывается с клиентом, расчёт происходит напрямую.
            </p>
          ) : (
            <p className="text-lg font-bold text-primary">Компенсация выезда: {offer.compensation} ₸</p>
          )}
          <Button variant="urgent" size="lg" fullWidth onClick={acceptOffer}>
            Принять ({secondsLeft} с)
          </Button>
        </Card>
      </div>
    );
  }

  if (order) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-bold text-ink">{order.category?.name}</h1>
        <Card className="space-y-1">
          <p className="text-sm text-ink">{order.address}</p>
          <p className="text-sm text-ink-soft">{order.description}</p>
          {order.client && (
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
          <Button fullWidth onClick={() => action('on-way')}>
            Еду
          </Button>
        )}
        {order.status === 'MASTER_ON_WAY' && (
          <Button fullWidth onClick={() => action('on-site')}>
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
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              fullWidth
              disabled={!Number(price)}
              onClick={() => action('propose-price', { amount: Number(price), comment: comment || undefined })}
            >
              Отправить цену
            </Button>
          </div>
        )}
        {order.status === 'AWAITING_PRICE_CONFIRM' && (
          <Alert tone="info">Ожидание подтверждения цены клиентом…</Alert>
        )}
        {order.status === 'IN_PROGRESS' && (
          <Button fullWidth variant="success" onClick={() => action('complete')}>
            Выполнено
          </Button>
        )}
        {['ACCEPTED', 'MASTER_ON_WAY'].includes(order.status) && (
          <Button
            fullWidth
            variant="danger"
            onClick={() => action('cancel', undefined, 'Отменить заявку? Заявка вернётся в поиск, отмены фиксируются.')}
          >
            Отменить
          </Button>
        )}
      </div>
    );
  }

  const hasFreeOrders = feed.some((item) => item.commercialMode === 'FREE_PILOT');
  const hasPaidOrders = feed.some((item) => item.commercialMode !== 'FREE_PILOT');
  const selectedFree = plannedOrder
    ? plannedOrder.commercialMode
      ? plannedOrder.commercialMode === 'FREE_PILOT'
      : !leadCreditsEnabled
    : false;

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6">
      <div className="flex gap-1 rounded-pill border border-border p-1">
        <Button
          fullWidth
          variant={tab === 'urgent' ? 'primary' : 'ghost'}
          icon={<BoltIcon size={16} />}
          aria-pressed={tab === 'urgent'}
          onClick={() => setTab('urgent')}
        >
          Срочные
        </Button>
        <Button
          fullWidth
          variant={tab === 'planned' ? 'primary' : 'ghost'}
          icon={<CalendarIcon size={16} />}
          aria-pressed={tab === 'planned'}
          onClick={() => setTab('planned')}
        >
          Плановые
        </Button>
      </div>

      {tab === 'urgent' && (
        <>
          <Card className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-ink">{online ? 'Вы онлайн' : 'Вы офлайн'}</div>
              <div className="text-sm text-ink-soft">
                {connected ? 'Соединение активно' : 'Нет соединения'}
              </div>
            </div>
            <Button variant={online ? 'secondary' : 'primary'} onClick={online ? goOffline : goOnline}>
              {online ? 'Выйти' : 'Онлайн'}
            </Button>
          </Card>
          {geoDenied && (
            <Alert tone="warning">
              Без доступа к геолокации заявки приходить не будут. Разрешите доступ в настройках браузера и попробуйте снова.
            </Alert>
          )}
          {offerNote && <Alert tone="info">{offerNote}</Alert>}
          {online && <p className="text-center text-sm text-ink-soft">Ждём заявки рядом с вами…</p>}
        </>
      )}

      {tab === 'planned' && !plannedOrder && (
        <div className="space-y-3">
          {(leadCreditsEnabled || hasPaidOrders) && (
            <Link
              to="/lead-credits"
              className="flex min-h-11 items-center justify-center text-center text-sm font-bold text-primary underline"
            >
              Баланс кредитов — нужен для платных заявок
            </Link>
          )}
          {(!leadCreditsEnabled || hasFreeOrders) && (
            <Alert tone="info">Заявки с отметкой «Бесплатно» не расходуют lead-кредиты.</Alert>
          )}
          {plannedError && <Alert tone="danger">{plannedError}</Alert>}
          {!feedLoaded ? (
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
                      onClick={() => openPlannedOrder(item.id)}
                      className="block w-full rounded-lg p-4 text-left transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-fill-faint"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-sm font-bold text-ink">{item.category?.name}</span>
                        <span className="flex flex-col items-end gap-1">
                          <span className="text-xs text-ink-soft">{item._count.bids}/5 ставок</span>
                          <Badge tone={free ? 'success' : 'primary'}>
                            {free ? 'Бесплатно' : '1 кредит'}
                          </Badge>
                        </span>
                      </span>
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
      )}

      {tab === 'planned' && plannedOrder && (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeftIcon size={18} />}
            className="-ml-3"
            onClick={() => setPlannedOrder(null)}
          >
            Назад к ленте
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">{plannedOrder.category?.name}</h2>
            <Badge tone={selectedFree ? 'success' : 'primary'}>
              {selectedFree ? 'Бесплатный отклик' : 'Отклик: 1 кредит'}
            </Badge>
          </div>
          <Card className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-sm text-ink-soft">
              <MapPinIcon size={16} className="shrink-0" />
              {plannedOrder.district}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-ink-soft">
              <CalendarIcon size={16} className="shrink-0" />
              {new Date(plannedOrder.slotStart).toLocaleString('ru-RU')}
            </p>
            <p className="text-sm text-ink">{plannedOrder.description}</p>
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
          {plannedError && <Alert tone="danger">{plannedError}</Alert>}
          <Button fullWidth disabled={!Number(bidPrice) || !bidTerm} onClick={submitBid}>
            {selectedFree ? 'Откликнуться бесплатно' : 'Откликнуться (1 кредит)'}
          </Button>
        </div>
      )}
    </div>
  );
}
