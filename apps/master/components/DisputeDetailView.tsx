'use client';
import Link from 'next/link';
import {Button,disputeText,useLocale,type DisputeSummary} from '@masterqala/ui';
import {useAuth} from '../lib/auth';
import {useMasterDisputes} from '../lib/useMasterDisputes';
import {OwnedMasterDispute} from './desktop-dispute/DesktopDispute';
function VerifiedDetail({ownerId,summary}:{ownerId:string;summary:DisputeSummary}) {
  const kind=summary.orderId?'orders':'planned-orders',id=(summary.orderId??summary.plannedOrderId)!;
  return <OwnedMasterDispute key={`${ownerId}:${kind}:${id}:${summary.id}`} ownerId={ownerId} kind={kind} id={id} expectedDisputeId={summary.id}/>;
}
export function DisputeDetailView({disputeId}:{disputeId:string}) {
  const {user}=useAuth(),{language}=useLocale();
  const state=useMasterDisputes(user?.id??null,disputeId);
  const summary=state.fresh?state.disputes.find(item=>item.id===disputeId):undefined;
  if(user&&summary)return <VerifiedDetail key={`${user.id}:${disputeId}`} ownerId={user.id} summary={summary}/>;
  const t=(key:Parameters<typeof disputeText>[1])=>disputeText(language,key);
  return <section className="mx-auto flex w-full max-w-[960px] flex-col gap-6 p-6"><h1 className="text-2xl font-semibold md:text-[32px]">{t('title')}</h1><Link href="/disputes" className="inline-flex min-h-[56px] items-center text-primary">{t('orders')}</Link>{state.loading&&<p role="status">{t('loading')}</p>}{(state.error||state.fresh&&!summary)&&<div role="alert" className="flex flex-col gap-3"><p>{t(state.error?'readError':'contextUnavailable')}</p><Button disabled={state.loading} variant="secondary" onClick={()=>{void state.retry();}}>{t('retry')}</Button></div>}</section>;
}
