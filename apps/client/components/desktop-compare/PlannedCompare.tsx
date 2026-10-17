'use client';
import {formatServiceDate} from '@masterqala/ui';
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {useLocale} from '@masterqala/ui';
import {useTranslation} from 'react-i18next';
import {useAuth} from '@/lib/auth';
import {api} from '@/lib/api';
import {getSocket} from '@/lib/socket';
import type {PlannedBid, PlannedOrderDetail} from '@/lib/plannedOrderTypes';
import SelectBidConfirm from '../planned-order-views/SelectBidConfirm';
import {compareCopy, confirmationCopy} from './copy';
import './compare.css';

const sameOffer = (a: PlannedBid, b: PlannedBid) =>
  a.id === b.id && a.master.id === b.master.id && a.price === b.price && a.term === b.term && a.comment === b.comment;
const selectable = (order: PlannedOrderDetail) => order.status === 'PUBLISHED' && (!order.lifecycleModel || order.lifecycleModel === 'LEGACY');

export default function PlannedCompare() {
  const {id} = useParams<{id: string}>();
  const {user} = useAuth();
  return user && id ? <OwnedCompare key={`${user.id}:${id}`} id={id} /> : null;
}

function OwnedCompare({id}: {id: string}) {
  const {language} = useLocale(), c = compareCopy[language], {t} = useTranslation();
  const router = useRouter();
  const [order, setOrder] = useState<PlannedOrderDetail | null>(null);
  const [selected, setSelected] = useState<PlannedBid | null>(null);
  const [error, setError] = useState(false), [refreshing, setRefreshing] = useState(true);
  const [fresh, setFresh] = useState(false), [submitting, setSubmitting] = useState(false);
  const [changed, setChanged] = useState(false), [online, setOnline] = useState(true);
  const lifetime = useRef<object | null>(null);
  const request = useRef<AbortController | null>(null);
  const verified = useRef<PlannedOrderDetail | null>(null);
  const selectionFlight = useRef(false);

  useLayoutEffect(() => {
    const current = {};
    lifetime.current = current;
    return () => { lifetime.current = null; verified.current = null; request.current?.abort(); };
  }, []);

  const load = useCallback(async () => {
    const current = lifetime.current;
    if (!current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    verified.current = null;
    setFresh(false); setRefreshing(true); setError(false);
    try {
      const result: PlannedOrderDetail = await api(`/planned-orders/${encodeURIComponent(id)}`, {signal: controller.signal});
      if (lifetime.current !== current || controller.signal.aborted) return;
      if (result.id !== id || !Array.isArray(result.bids)) throw new Error('Invalid order response');
      verified.current = result;
      setOrder(result); setFresh(true);
    } catch {
      if (lifetime.current === current && !controller.signal.aborted) setError(true);
    } finally {
      if (lifetime.current === current && !controller.signal.aborted) setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    const current = lifetime.current;
    const refresh = () => { if (lifetime.current === current && current) void load(); };
    const update = (event: {plannedOrderId: string}) => { if (event.plannedOrderId === id) refresh(); };
    const offline = () => {
      if (lifetime.current !== current || !current) return;
      request.current?.abort(); verified.current = null;
      setOnline(false); setFresh(false); setRefreshing(false);
    };
    const reconnect = () => { if (lifetime.current === current && current) { setOnline(navigator.onLine); refresh(); } };
    const foreground = () => { if (document.visibilityState === 'visible') reconnect(); };
    setOnline(navigator.onLine);
    refresh();
    const socket = getSocket();
    socket.on('bid:new', update); socket.on('planned:status', update); socket.on('connect', reconnect);
    window.addEventListener('online', reconnect); window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', foreground);
    return () => {
      socket.off('bid:new', update); socket.off('planned:status', update); socket.off('connect', reconnect);
      window.removeEventListener('online', reconnect); window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', foreground);
    };
  }, [id, load]);

  const validSelection = !!(order && selected && selectable(order) && order.bids.some(bid => sameOffer(bid, selected)));
  useEffect(() => {
    if (selected && fresh && !validSelection && !submitting) { setSelected(null); setChanged(true); }
  }, [selected, fresh, validSelection, submitting]);

  const canSubmit = (bid: PlannedBid) => {
    const current = verified.current;
    return !!(lifetime.current && !selectionFlight.current && navigator.onLine && current && selectable(current) && current.bids.some(candidate => sameOffer(candidate, bid)));
  };
  const choose = (bid: PlannedBid) => { if (canSubmit(bid)) { setChanged(false); setSelected(bid); } };
  const locale = language === 'kk' ? 'kk-KZ' : language === 'en' ? 'en-GB' : 'ru-RU';
  const money = (value: number) => new Intl.NumberFormat(locale, {style: 'currency', currency: 'KZT', maximumFractionDigits: 0}).format(value);
  const date = (value: string) => {
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? c.unavailable : formatServiceDate(instant,locale,{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
  };
  const rows: {label: string; value: (bid: PlannedBid) => string}[] = [
    {label: c.price, value: bid => money(bid.price)},
    {label: c.rating, value: bid => bid.master.rating == null ? c.unavailable : new Intl.NumberFormat(locale, {minimumFractionDigits: 1, maximumFractionDigits: 1}).format(bid.master.rating)},
    {label: c.orders, value: bid => bid.master.completedCount.toLocaleString(locale)},
    {label: c.experience, value: bid => new Intl.NumberFormat(locale, {style: 'unit', unit: 'year', unitDisplay: 'long'}).format(bid.master.experienceYears)},
    {label: c.term, value: bid => bid.term || c.unavailable},
    {label: c.comment, value: bid => bid.comment || '—'},
  ];

  return <div className="compare-page">
    <header className="compare-heading">
      <Link href={`/planned/${encodeURIComponent(id)}`}>← {c.back}</Link>
      <h1>{c.title}</h1><p>{c.intro}</p>
    </header>
    <div className="compare-columns">
      <section className="compare-card compare-offers" aria-busy={refreshing}>
        <div className="compare-section-heading"><h2>{c.offers}</h2>{order && <span className="compare-count">{order.bids.length}</span>}</div>
        {!online && <p role="status" className="compare-notice">{c.offline}</p>}
        {error && <div role="alert" className="compare-error"><p>{c.error}</p><button type="button" data-compare-retry onClick={() => void load()}>{c.retry}</button></div>}
        {refreshing && <p role="status" className="compare-update">{order ? c.updating : c.loading}</p>}
        {changed && <p role="status" className="compare-notice">{c.changed}</p>}
        {order && !selectable(order) && <p className="compare-notice">{c.readonly}</p>}
        {selected ? <div className="compare-confirm"><SelectBidConfirm
          key={selected.id} plannedOrderId={id} bid={selected}
          disabled={!fresh || !online || !validSelection}
          copy={confirmationCopy[language]}
          canSubmit={() => canSubmit(selected)}
          onSubmittingChange={value => { selectionFlight.current = value; if (lifetime.current) setSubmitting(value); }}
          onBack={() => { if (!selectionFlight.current) setSelected(null); }}
          onSelected={() => { if (lifetime.current) router.push(`/planned/${encodeURIComponent(id)}`); }}
        /></div> : order && (order.bids.length ? <div className="compare-offer-list" aria-label={c.offers}>
          {order.bids.map(bid => <article className="compare-offer" data-compare-offer={bid.id} key={bid.id}>
            <header className="compare-offer-header"><div className="compare-avatar" aria-hidden="true">{(bid.master.name || c.master).slice(0, 2).toUpperCase()}</div><div><h3 className="compare-master">{bid.master.name || c.master}</h3>{bid.master.verified && <span className="compare-verified">{c.verified}</span>}</div></header>
            <dl className="compare-offer-terms">{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value(bid)}</dd></div>)}</dl>
            {selectable(order) && <button type="button" data-compare-select={bid.id} disabled={!fresh || !online || submitting} onClick={() => choose(bid)} aria-label={`${c.choose}: ${bid.master.name || c.master}`}>{c.choose}</button>}
          </article>)}
        </div> : <div className="compare-empty" data-compare-empty><h3>{c.empty}</h3><p>{c.emptyNote}</p></div>)}
      </section>
      <aside className="compare-card compare-summary">
        <h2>{c.details}</h2>
        {order ? <><dl>
          <div><dt>{c.category}</dt><dd>{t(`newOrder.category_${order.category?.slug}`, {defaultValue: order.category?.name || c.unavailable})}</dd></div>
          <div><dt>{c.description}</dt><dd>{order.description}</dd></div>
          <div><dt>{c.address}</dt><dd>{order.address}{order.district ? ` · ${order.district}` : ''}</dd></div>
          <div><dt>{c.slot} · {c.zone}</dt><dd>{date(order.slotStart)} — {date(order.slotEnd)}</dd></div>
          {order.budget != null && <div><dt>{c.budget}</dt><dd>{money(order.budget)}</dd></div>}
        </dl>{order.commercialMode === 'FREE_PILOT' && <div className="compare-pilot"><strong>{c.pilot}</strong><p>{c.pilotNote}</p></div>}</> : <p>{error ? c.unavailable : c.loading}</p>}
      </aside>
    </div>
  </div>;
}
