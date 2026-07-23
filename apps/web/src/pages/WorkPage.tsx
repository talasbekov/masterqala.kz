import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
      .catch((e) => setPlannedError((e as Error).message));
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
      <div className="fixed inset-0 z-20 flex flex-col justify-center bg-teal-800 p-6 text-white">
        <div className="space-y-3 text-center">
          <div className="text-sm uppercase opacity-70">Новая заявка · {offer.distanceKm} км</div>
          <h1 className="text-2xl font-bold">{offer.category}</h1>
          <p>{offer.description}</p>
          {offer.address && <p className="opacity-80">{offer.address}</p>}
          {offer.freePilot ? (
            <div className="rounded-xl bg-white/10 p-3 text-sm font-semibold">
              Бесплатный пилот: стоимость работ согласовывается с клиентом, расчёт происходит напрямую.
            </div>
          ) : (
            <div className="text-xl font-semibold">Компенсация выезда: {offer.compensation} ₸</div>
          )}
          <button onClick={acceptOffer} className="w-full rounded-xl bg-white p-4 text-xl font-bold text-teal-800">
            Принять ({secondsLeft} с)
          </button>
        </div>
      </div>
    );
  }

  if (order) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-bold">{order.category?.name}</h1>
        <div className="space-y-1 rounded-xl border p-4">
          <div>{order.address}</div>
          <div className="text-sm text-gray-600">{order.description}</div>
          {order.client && (
            <a href={`tel:${order.client.phone}`} className="text-teal-700 underline">
              {order.client.phone}
            </a>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}

        {order.status === 'ACCEPTED' && (
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('on-way')}>
            Еду
          </button>
        )}
        {order.status === 'MASTER_ON_WAY' && (
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('on-site')}>
            На месте
          </button>
        )}
        {order.status === 'INSPECTION' && (
          <div className="space-y-2">
            <input
              type="number"
              min="1"
              placeholder="Стоимость работ, ₸"
              className="w-full rounded border p-3"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <input
              placeholder="Комментарий (необязательно)"
              className="w-full rounded border p-3"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              className="w-full rounded bg-teal-700 p-3 text-white disabled:opacity-40"
              disabled={!Number(price)}
              onClick={() => action('propose-price', { amount: Number(price), comment: comment || undefined })}
            >
              Отправить цену
            </button>
          </div>
        )}
        {order.status === 'AWAITING_PRICE_CONFIRM' && (
          <p className="text-center text-gray-600">Ожидание подтверждения цены клиентом…</p>
        )}
        {order.status === 'IN_PROGRESS' && (
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('complete')}>
            Выполнено
          </button>
        )}
        {['ACCEPTED', 'MASTER_ON_WAY'].includes(order.status) && (
          <button
            className="w-full rounded border border-red-300 p-3 text-red-600"
            onClick={() => action('cancel', undefined, 'Отменить заявку? Заявка вернётся в поиск, отмены фиксируются.')}
          >
            Отменить
          </button>
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
      <div className="flex rounded-full border p-1">
        <button
          className={`flex-1 rounded-full py-2 text-sm ${tab === 'urgent' ? 'bg-teal-700 text-white' : ''}`}
          onClick={() => setTab('urgent')}
        >
          Срочные
        </button>
        <button
          className={`flex-1 rounded-full py-2 text-sm ${tab === 'planned' ? 'bg-teal-700 text-white' : ''}`}
          onClick={() => setTab('planned')}
        >
          Плановые
        </button>
      </div>

      {tab === 'urgent' && (
        <>
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <div className="font-semibold">{online ? 'Вы онлайн' : 'Вы офлайн'}</div>
              <div className="text-sm text-gray-500">{connected ? 'Соединение активно' : 'Нет соединения'}</div>
            </div>
            <button
              onClick={online ? goOffline : goOnline}
              className={`rounded-full px-5 py-2 text-white ${online ? 'bg-gray-400' : 'bg-teal-700'}`}
            >
              {online ? 'Выйти' : 'Онлайн'}
            </button>
          </div>
          {geoDenied && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm">
              Без доступа к геолокации заявки приходить не будут. Разрешите доступ в настройках браузера и попробуйте снова.
            </p>
          )}
          {offerNote && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">{offerNote}</p>}
          {online && <p className="text-center text-gray-500">Ждём заявки рядом с вами…</p>}
        </>
      )}

      {tab === 'planned' && !plannedOrder && (
        <div className="space-y-3">
          {(leadCreditsEnabled || hasPaidOrders) && (
            <Link to="/lead-credits" className="block text-center text-teal-700 underline">
              Баланс кредитов — нужен для платных заявок
            </Link>
          )}
          {(!leadCreditsEnabled || hasFreeOrders) && (
            <div className="rounded-xl bg-teal-50 p-3 text-center text-sm font-semibold text-teal-800">
              Заявки с отметкой «Бесплатно» не расходуют lead-кредиты.
            </div>
          )}
          {plannedError && <p className="text-sm text-red-600">{plannedError}</p>}
          {feed.length === 0 && <p className="text-center text-gray-500">Пока нет заявок в ваших категориях</p>}
          {feed.map((item) => {
            const free = item.commercialMode === 'FREE_PILOT';
            return (
              <button
                key={item.id}
                onClick={() => openPlannedOrder(item.id)}
                className="block w-full rounded-xl border p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{item.category?.name}</span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm text-gray-500">{item._count.bids}/5 ставок</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${free ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800'}`}>
                      {free ? 'Бесплатно' : '1 кредит'}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-600">{item.district}</div>
                <div className="text-sm text-gray-500">{new Date(item.slotStart).toLocaleString('ru-RU')}</div>
              </button>
            );
          })}
        </div>
      )}

      {tab === 'planned' && plannedOrder && (
        <div className="space-y-3">
          <button className="text-sm text-gray-500" onClick={() => setPlannedOrder(null)}>
            ← Назад к ленте
          </button>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold">{plannedOrder.category?.name}</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedFree ? 'bg-teal-50 text-teal-800' : 'bg-amber-50 text-amber-800'}`}>
              {selectedFree ? 'Бесплатный отклик' : 'Отклик: 1 кредит'}
            </span>
          </div>
          <div className="text-sm text-gray-600">{plannedOrder.district}</div>
          <div className="text-sm text-gray-500">{new Date(plannedOrder.slotStart).toLocaleString('ru-RU')}</div>
          <div className="text-sm text-gray-600">{plannedOrder.description}</div>
          <input
            type="number"
            min="1"
            placeholder="Ваша цена, ₸"
            className="w-full rounded border p-3"
            value={bidPrice}
            onChange={(e) => setBidPrice(e.target.value)}
          />
          <input
            placeholder="Срок (например: сегодня до 18:00)"
            className="w-full rounded border p-3"
            value={bidTerm}
            onChange={(e) => setBidTerm(e.target.value)}
          />
          <input
            placeholder="Комментарий (необязательно)"
            className="w-full rounded border p-3"
            value={bidComment}
            onChange={(e) => setBidComment(e.target.value)}
          />
          {plannedError && <p className="text-sm text-red-600">{plannedError}</p>}
          <button
            className="w-full rounded bg-teal-700 p-3 text-white disabled:opacity-40"
            disabled={!Number(bidPrice) || !bidTerm}
            onClick={submitBid}
          >
            {selectedFree ? 'Откликнуться бесплатно' : 'Откликнуться (1 кредит)'}
          </button>
        </div>
      )}
    </div>
  );
}
