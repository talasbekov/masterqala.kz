'use client';
import Link from 'next/link';
import {Button,OrderDisputeView,disputeText,useLocale,useOrderDispute,type DisputeSummary} from '@masterqala/ui';
import {useAuth} from '../lib/auth';
import {api,apiUpload} from '../lib/api';
import {useMasterDisputes} from '../lib/useMasterDisputes';
function VerifiedDetail({ownerId,summary}:{ownerId:string;summary:DisputeSummary}) {
  const {language}=useLocale();
  const kind=summary.orderId?'orders':'planned-orders',id=(summary.orderId??summary.plannedOrderId)!;
  const controller=useOrderDispute({ownerId,target:{kind,id},expectedDisputeId:summary.id,api,upload:apiUpload});
  return <OrderDisputeView controller={controller} role="master" orderHref={`/${kind==='orders'?'order':'planned'}/${encodeURIComponent(id)}`} listHref="/disputes" confirmReply={()=>window.confirm(disputeText(language,'confirmReply'))} renderLink={({href,children,className,ariaLabel})=><Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
export function DisputeDetailView({disputeId}:{disputeId:string}) {
  const {user}=useAuth(),{language}=useLocale();
  const state=useMasterDisputes(user?.id??null,disputeId);
  const summary=state.fresh?state.disputes.find(item=>item.id===disputeId):undefined;
  if(user&&summary)return <VerifiedDetail key={`${user.id}:${disputeId}`} ownerId={user.id} summary={summary}/>;
  const t=(key:Parameters<typeof disputeText>[1])=>disputeText(language,key);
  return <section className="mx-auto flex w-full max-w-[960px] flex-col gap-6 p-6"><h1 className="text-2xl font-semibold md:text-[32px]">{t('title')}</h1><Link href="/disputes" className="inline-flex min-h-[56px] items-center text-primary">{t('orders')}</Link>{state.loading&&<p role="status">{t('loading')}</p>}{(state.error||state.fresh&&!summary)&&<div role="alert" className="flex flex-col gap-3"><p>{t(state.error?'readError':'contextUnavailable')}</p><Button disabled={state.loading} variant="secondary" onClick={()=>{void state.retry();}}>{t('retry')}</Button></div>}</section>;
}
