'use client';
import {formatServiceDate} from '@masterqala/ui';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {masterDesignCopy} from '@/lib/masterDesignCopy';
import {Button, useLocale} from '@masterqala/ui';
import {useMasterHistory, type HistoryFilter} from '@/lib/master-history';
import {masterHistoryCopy} from '@/lib/master-history-copy';
import {masterCategoryName} from '@/lib/category-name';

export function MasterHistoryView() {
  const {language,t} = useLocale();
  const copy = masterHistoryCopy(language), design=masterDesignCopy(language);
  const router=useRouter(),search=useSearchParams(),requestedFilter=search?.get('filter');
  const filter:HistoryFilter=requestedFilter==='active'||requestedFilter==='history'?requestedFilter:'all';
  const selectFilter=(value:HistoryFilter)=>{
    if(value===filter)return;
    const params=new URLSearchParams(search?.toString());
    params.set('filter',value);
    router.push(`/history?${params}`,{scroll:false});
  };
  const history = useMasterHistory(filter);
  const statuses = {CREATED:t('ownedCreated'), SEARCHING:t('searching'), ACCEPTED:t('assigned'), MASTER_ON_WAY:t('enroute'), INSPECTION:t('inspection'), AWAITING_PRICE_CONFIRM:t('quote'), PRICE_APPROVED:t('approved'), IN_PROGRESS:t('working'), DONE:copy.done, CLOSED:copy.closed, NO_MASTERS:t('nomatch'), CANCELLED_BY_CLIENT:t('ownedCancelledClient'), CANCELLED_BY_MASTER:t('ownedCancelledMaster'), DISPUTE:t('ownedDispute'), PUBLISHED:t('ownedPublished'), MASTER_SELECTED:t('ownedSelected'), CONFIRMED:t('ownedConfirmed'), EXPIRED:t('ownedExpired')};
  if (!history.authenticated) return null;
  // Match /master/orders: DONE still awaits acceptance; terminal states differ by kind.
  const current=history.items.find(item=>!(item.kind==='urgent'
    ? ['CLOSED','NO_MASTERS','CANCELLED_BY_CLIENT','CANCELLED_BY_MASTER']
    : ['CLOSED','EXPIRED','CANCELLED_BY_CLIENT','CANCELLED_BY_MASTER']).includes(item.status));
  const href=(item:typeof history.items[number])=>`/${item.kind==='urgent'?'order':'planned'}/${encodeURIComponent(item.id)}`;
  return <section className="mq-master-dashboard mq-master-history" aria-labelledby="master-history-title">
    <h1 id="master-history-title">{copy.title}</h1><p className="mq-master-overview__intro">{copy.note}</p>
    <div className="mq-master-history__filters" aria-label={copy.title}>{(['all','active','history'] as const).map(value=><Button key={value} variant={value===filter?'accent':'white'} aria-pressed={value===filter} onClick={()=>selectFilter(value)} data-history-filter={value}>{copy[value]}</Button>)}</div>
    <div className="mq-master-dashboard__grid"><div className="mq-master-dashboard__main">
    {history.loading&&<p role="status">{t('loading')}</p>}
    {history.error&&<div role="alert" className="mq-master-card"><p>{copy.error}</p><Button variant="secondary" onClick={history.retry} disabled={history.loading}>{t('retry')}</Button></div>}
    {!history.loading&&!history.error&&history.items.length===0&&<div data-history-empty className="mq-master-card"><h2>{copy.empty}</h2><p>{copy.emptyNote}</p></div>}
    {history.items.length>0&&<div className="mq-master-history__table"><div className="mq-master-history__head" aria-hidden="true"><span>{design.order}</span><span>{design.task}</span><span>{design.status}</span><span>{design.amount}</span></div><ul>{history.items.map(item=><li key={`${item.kind}:${item.id}`}><Link className="mq-master-history__row" href={href(item)} aria-label={`${copy.open}: ${item.id}`}>
      <span><span className="mq-master-history__id">{t('orderNumber',{id:item.id})}</span><time dateTime={item.createdAt}>{formatServiceDate(new Date(item.createdAt),language,{day:'numeric',month:'long',year:'numeric'})}</time></span>
      <span><h2>{masterCategoryName(item.category,language)}</h2><small>{copy[item.kind]} · {item.district}</small></span><span>{statuses[item.status as keyof typeof statuses]??copy.unknown}</span><span className="mq-master-muted">{design.noAmount}</span>
    </Link></li>)}</ul></div>}
    {history.nextCursor&&!history.error&&<Button variant="secondary" loading={history.loading} onClick={history.loadMore}>{copy.more}</Button>}
    <Link href="/" className="mq-master-secondary-action">{copy.back}</Link>
    </div><aside className="mq-master-dashboard__aside"><section className="mq-master-card"><h2>{current?t('orderNumber',{id:current.id}):design.noActive}</h2><p>{current?masterCategoryName(current.category,language):design.historyHelp}</p>{current&&<><p>{current.district}</p><Link className="mq-master-finance__action" href={href(current)}>{copy.open}</Link></>}<Link className="mq-master-secondary-action" href="/disputes">{design.disputes}</Link></section></aside></div>
  </section>;
}
