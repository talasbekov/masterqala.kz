'use client';
import type {ReactNode} from 'react';
import {useLocale} from './Locale';
import {Button} from './Button';
import {disputeText,disputeDate} from './dispute-copy';
import type {DisputeSummary} from './disputes';
import type {OwnedOrderLinkProps} from './OwnedOrdersView';
export function OwnedDisputesView({disputes,loading,error,fresh,onRetry,renderLink}:{disputes:DisputeSummary[];loading:boolean;error:string;fresh:boolean;onRetry:()=>void;renderLink:(props:OwnedOrderLinkProps)=>ReactNode}) {
  const {language}=useLocale(),t=(key:Parameters<typeof disputeText>[1])=>disputeText(language,key);
  return <section className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col gap-6 px-6 py-6"><header className="flex flex-wrap justify-between gap-4"><h1 className="break-words text-2xl font-semibold md:text-[32px]">{t('list')}</h1>{renderLink({href:'/',children:t('home'),className:'inline-flex min-h-11 items-center rounded-md px-3 text-primary focus-visible:outline-2 focus-visible:outline-primary'})}</header>{loading&&<p role="status">{t('loading')}</p>}{error&&<div role="alert" className="flex flex-col gap-3 rounded-2xl bg-fill-soft p-6"><p>{t('readError')}</p>{disputes.length>0&&<p>{t('stale')}</p>}<Button variant="secondary" disabled={loading} onClick={onRetry}>{t('retry')}</Button></div>}<div className="flex min-w-0 flex-col gap-4">{disputes.map(item=><div key={item.id} className="min-w-0">{renderLink({href:'/disputes/'+encodeURIComponent(item.id),ariaLabel:item.reason,children:<div className="flex min-w-0 flex-col gap-3"><p className="break-words whitespace-pre-wrap text-base font-semibold">{item.reason}</p><p className="text-sm text-ink-soft">{disputeDate(language,item.createdAt)}</p><p className="text-sm">{t(item.status==='OPEN'?'open':'resolved')}</p></div>,className:'block min-w-0 rounded-2xl bg-surface p-6 text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'})}</div>)}</div>{fresh&&!loading&&!error&&disputes.length===0&&<p>{t('empty')}</p>}</section>;
}
