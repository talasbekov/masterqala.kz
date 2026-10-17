'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, useLocale, useOwnedAccountResource } from '@masterqala/ui';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { masterCategoryName } from '@/lib/category-name';
import { getSocket } from '@/lib/socket';
import { parsePlannedFeed, type PlannedFeedItem } from '@/lib/plannedFeed';
import { plannedCopy, plannedSlot } from '@/lib/plannedCopy';
import { PlannedOrderPanel } from './desktop-planned/PlannedOrderPanel';
import './desktop-planned/planned.css';

export function PlannedFeedView() {
  const { user } = useAuth(), params = useSearchParams();
  const selectedId = params?.get('planned') ?? null;
  if (!user) return null;
  return selectedId ? <PlannedOrderPanel key={`${user.id}:${selectedId}`} ownerId={user.id} id={selectedId}/> : <Feed key={user.id} ownerId={user.id}/>;
}
function Feed({ ownerId }: { ownerId: string }) {
  const { language, formatMoney } = useLocale(), copy = plannedCopy(language);
  const readFlight = useRef<Promise<PlannedFeedItem[]> | null>(null);
  const read = useCallback((path: string) => {
    if (!readFlight.current) readFlight.current = api(path).then(parsePlannedFeed).finally(() => { readFlight.current = null; });
    return readFlight.current;
  }, []);
  const resource = useOwnedAccountResource<PlannedFeedItem[]>({ ownerId, path: '/planned-orders/feed', api: read });
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let live = true;
    setOnline(navigator.onLine);
    const socket = getSocket(), events = ['planned:status', 'bid:closed', 'bid:selected', 'connect'];
    const refresh = () => { if (live) void resource.retry(); };
    const connection = () => { if (live) { setOnline(navigator.onLine); if (navigator.onLine) refresh(); } };
    events.forEach(event => socket.on(event, refresh));
    window.addEventListener('online', connection); window.addEventListener('offline', connection); window.addEventListener('focus', refresh);
    return () => { live = false; events.forEach(event => socket.off(event, refresh)); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); window.removeEventListener('focus', refresh); };
  }, [resource.retry]);
  return <section className="mq-planned" aria-label={copy.title}>
    <div className="mq-planned__toolbar"><h2>{copy.title}</h2><Button variant="secondary" loading={resource.loading} disabled={!online} onClick={() => void resource.retry()}>{copy.refresh}</Button></div>
    {!online && <p className="mq-planned__notice" role="status">{copy.offline}</p>}
    {resource.error && <p className="mq-planned__error" role="alert">{copy.read}</p>}
    {resource.data && !resource.fresh && <p role="status">{copy.stale}</p>}
    {resource.loading && !resource.data && <p role="status">{copy.loading}</p>}
    {resource.fresh && resource.data?.length === 0 && <div className="mq-planned__card"><h2>{copy.empty}</h2><p className="mq-planned__muted">{copy.emptyNote}</p></div>}
    {!!resource.data?.length && <div className="mq-planned__columns"><div className="mq-planned__list">{resource.data.map(item => <article className="mq-planned__card" key={item.id}>
      <div className="mq-planned__toolbar"><h2>{item.category ? masterCategoryName(item.category, language) : copy.category}</h2><span className="mq-planned__badge">{copy.offers}: {item._count?.bids ?? '—'}/5</span></div>
      <p>{item.district}</p><p>{plannedSlot(item.slotStart, item.slotEnd, language)}</p><p className="mq-planned__description">{item.description}</p>
      {item.budget != null && <p>{copy.budget}: {formatMoney(item.budget)}</p>}
      <span className="mq-planned__badge">{item.commercialMode === 'FREE_PILOT' ? copy.free : copy.paid}</span>
      {(item._count?.bids ?? 0) >= 5 && <p className="mq-planned__muted">{copy.full}</p>}
      <Link className="mq-planned__link" href={`/?tab=planned&planned=${encodeURIComponent(item.id)}`}>{copy.detail}</Link>
    </article>)}</div><aside className="mq-planned__card"><h2>{copy.history}</h2><p>{copy.historyNote}</p><Link className="mq-planned__link" href="/history">{copy.history}</Link></aside></div>}
  </section>;
}
