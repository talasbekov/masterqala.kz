'use client';
import {Button,useLocale} from '@masterqala/ui';
import Link from 'next/link';
export function NewOrderCreationStatus({persistent,submitting,completedOrderId,error,onRecover,online=true,recovering=false}:{pending:boolean;persistent:boolean;submitting:boolean;completedOrderId:string|null;error:string;onRecover?:()=>void;online?:boolean;recovering?:boolean}) {
 const {t}=useLocale();
 return <section className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 px-6 py-8">
   <h1 className="text-2xl font-semibold text-ink" aria-live="polite">{completedOrderId?t('createOutcomeConfirmed'):submitting?t(recovering?'checkSubmissionBusy':'submitBusy'):t('createOutcomeUnknown')}</h1>
   {!completedOrderId&&<p className="text-base leading-6 text-ink-soft">{t(onRecover?'createOutcomeKeyedHelp':'createOutcomeHelp')}</p>}
   {!completedOrderId&&!persistent&&<p role="alert" className="text-sm text-danger">{t('createOutcomeStorage')}</p>}
   {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
   {!completedOrderId&&onRecover&&<Button onClick={onRecover} loading={submitting} disabled={submitting||!online} fullWidth>{t(submitting&&recovering?'checkSubmissionBusy':'checkSubmission')}</Button>}
   {completedOrderId&&<Link className="rounded-pill bg-primary px-6 py-4 text-center font-semibold text-white" href={`/order/${encodeURIComponent(completedOrderId)}`}>{t('openCreatedOrder')}</Link>}
   <Link className="rounded-pill border border-primary px-6 py-4 text-center font-semibold text-primary" href="/orders">{t('orders')}</Link>
   <Link className="px-6 py-4 text-center font-semibold text-primary" href="/support">{t('support')}</Link>
 </section>;
}
