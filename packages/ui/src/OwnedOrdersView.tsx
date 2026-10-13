'use client';
import {useState, type ReactNode} from 'react';
import {useLocale} from './Locale';
import type {CopyKey} from './locale-data';
import {isOwnedOrderActive, presentOwnedOrderAmount, type OwnedOrderItem} from './owned-orders';
export interface OwnedOrderLinkProps {href: string; children: ReactNode; className?: string; ariaLabel?: string}
const statusKeys: Record<string, CopyKey> = {CREATED:'ownedCreated',SEARCHING:'searching',ACCEPTED:'assigned',MASTER_ON_WAY:'enroute',INSPECTION:'inspection',AWAITING_PRICE_CONFIRM:'quote',PRICE_APPROVED:'approved',IN_PROGRESS:'working',DONE:'done',CLOSED:'closed',NO_MASTERS:'nomatch',CANCELLED_BY_CLIENT:'ownedCancelledClient',CANCELLED_BY_MASTER:'ownedCancelledMaster',DISPUTE:'ownedDispute',PUBLISHED:'ownedPublished',MASTER_SELECTED:'ownedSelected',CONFIRMED:'ownedConfirmed',EXPIRED:'ownedExpired'};
export function OwnedOrdersView({items,loading,error,incomplete,onRetry,renderLink}: {items: OwnedOrderItem[]; loading: boolean; error: string; incomplete: boolean; onRetry: () => void; renderLink: (props: OwnedOrderLinkProps) => ReactNode}) {
  const {language,t,formatMoney} = useLocale();
  const [tab,setTab] = useState<'active'|'history'>('active');
  const shown = items.filter(item => isOwnedOrderActive(item) === (tab === 'active'));
  return <section className="mx-auto flex w-full max-w-[1328px] min-w-0 flex-col gap-6 px-6 py-6" aria-labelledby="owned-orders-heading">
    <h1 id="owned-orders-heading" className="text-[28px] leading-[34px] font-medium md:text-[32px] md:font-semibold">{t('orders')}</h1>
    <div className="flex min-h-[52px] w-full max-w-[400px] rounded-full bg-fill-soft p-1" aria-label={t('orders')}>
      {(['active','history'] as const).map(value => <button key={value} type="button" data-orders-filter={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`min-h-11 min-w-0 flex-1 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary ${tab === value ? 'bg-surface text-ink' : 'text-ink-soft'}`}>{t(value === 'active' ? 'ownedActive' : 'ownedHistory')}</button>)}
    </div>
    {loading && <p role="status">{t('loading')}</p>}
    {!!error && <div role="alert" className="rounded-2xl bg-fill-soft p-6 text-sm leading-[21px]"><p>{t('ownedReadError')}</p><button type="button" data-orders-retry disabled={loading} onClick={onRetry} className="mt-3 min-h-11 rounded-full border border-border px-6 font-semibold disabled:opacity-50">{t('retry')}</button></div>}
    {!loading && !incomplete && !error && shown.length === 0 && <div data-orders-empty className="rounded-2xl bg-fill-soft p-6"><h2 className="text-xl font-semibold">{t(tab === 'active' ? 'ownedEmptyActive' : 'ownedEmptyHistory')}</h2><p className="mt-2 text-sm leading-[21px] text-ink-soft">{t('ownedEmptyNote')}</p></div>}
    {shown.length > 0 && <div className="min-w-0">
      <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-6 px-6 pb-4 text-sm text-ink-soft lg:grid"><span>{t('order')}</span><span>{t('ownedTask')}</span><span>{t('ownedStatus')}</span><span>{t('ownedAmount')}</span></div>
      <ul className="flex min-w-0 flex-col gap-4 lg:gap-0">
        {shown.map(item => {
          const amount = presentOwnedOrderAmount(item);
          const timestamp = item.createdAt ? Date.parse(item.createdAt) : NaN;
          const date = Number.isFinite(timestamp) ? new Intl.DateTimeFormat(language === 'ru' ? 'ru-KZ' : language === 'kk' ? 'kk-KZ' : 'en-GB', {day:'numeric',month:'long',year:'numeric'}).format(timestamp) : null;
          const href = `${item.kind === 'urgent' ? '/order/' : '/planned/'}${encodeURIComponent(item.id)}`;
          const versionedDirect = item.kind === 'urgent' && (item.lifecycleVersion ?? 0) >= 2 && item.commercialMode === 'DIRECT_PAYMENT';
          const statusKey = !versionedDirect && item.status === 'DONE' ? 'ownedDone' : !versionedDirect && item.status === 'CLOSED' ? 'ownedClosed' : statusKeys[item.status] ?? 'ownedUnknownStatus';
          const status = t(statusKey);
          return <li key={`${item.kind}:${item.id}`} className="min-w-0 rounded-2xl bg-fill-soft p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-6 lg:rounded-none lg:border-b lg:border-border lg:bg-surface">
            <div className="min-w-0 break-words text-sm leading-[21px]"><p>{t('orderNumber',{id:item.id})}</p><p className="mt-1 text-ink-soft">{item.kind === 'planned' ? t('planned') : t('ownedUrgent')}</p></div>
            <div className="mt-4 min-w-0 break-words lg:mt-0"><h2 className="text-xl font-semibold">{item.description?.trim() || item.category?.name || t('ownedTask')}</h2>{item.address && <p className="mt-2 text-sm leading-[21px] text-ink-soft">{item.address}</p>}<p className="mt-2 text-sm leading-[21px] text-ink-soft">{date ? <time dateTime={item.createdAt!}>{date}</time> : '—'}</p>{item.master?.name?.trim() && <p className="mt-2 text-sm leading-[21px]">{item.master.name}</p>}
              {renderLink({href,children:t('ownedOpen'),ariaLabel:`${t('ownedOpen')}: ${t('orderNumber',{id:item.id})}`,className:'mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary'})}
            </div>
            <p className="mt-4 min-w-0 break-words text-sm leading-[21px] lg:mt-0"><span className={`inline-block rounded-full px-3 py-2 ${['CLOSED','PRICE_APPROVED','IN_PROGRESS'].includes(item.status) ? 'bg-success-bg text-success-ink' : 'bg-surface text-ink-soft'}`}>{status}</span></p>
            {amount && <div className="mt-4 min-w-0 break-words border-t border-border pt-4 text-sm leading-[21px] lg:mt-0 lg:border-0 lg:pt-0"><p className="text-ink-soft">{t(amount.label)}</p>{amount.label !== 'moneyUnknown' && <p className="mt-1 text-xl font-semibold">{amount.amount === null ? '—' : formatMoney(amount.amount)}</p>}</div>}
          </li>;
        })}
      </ul>
    </div>}
    <div className="flex flex-col gap-4 md:max-w-[400px]">{(items.some(item => item.kind === 'urgent' && (item.lifecycleVersion ?? 0) >= 2 && item.commercialMode === 'DIRECT_PAYMENT') || (!items.length && !incomplete)) && <p className="text-sm leading-[21px] text-ink-soft">{t('costControlNote')}</p>}{renderLink({href:'/order/new',children:t('newOrder'),className:'inline-flex min-h-14 items-center justify-center rounded-md bg-accent px-4 py-3 text-base font-semibold text-primary focus-visible:outline-2 focus-visible:outline-ink'})}</div>
  </section>;
}
