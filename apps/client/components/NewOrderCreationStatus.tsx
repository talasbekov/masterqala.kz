'use client';
import {useLocale} from '@masterqala/ui';
import Link from 'next/link';
export function NewOrderCreationStatus({persistent,submitting,completedOrderId,error}:{pending:boolean;persistent:boolean;submitting:boolean;completedOrderId:string|null;error:string}) {
 const {t}=useLocale();
 return <section className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 px-6 py-8">
   <h1 className="text-2xl font-semibold text-ink" aria-live="polite">{completedOrderId?t('createOutcomeConfirmed'):submitting?t('submitBusy'):t('createOutcomeUnknown')}</h1>
   {!completedOrderId&&<p className="text-base leading-6 text-ink-soft">{t('createOutcomeHelp')}</p>}
   {!completedOrderId&&!persistent&&<p role="alert" className="text-sm text-danger">{t('createOutcomeStorage')}</p>}
   {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
   {completedOrderId&&<Link className="rounded-pill bg-primary px-6 py-4 text-center font-semibold text-white" href={`/order/${encodeURIComponent(completedOrderId)}`}>{t('openCreatedOrder')}</Link>}
   <Link className="rounded-pill border border-primary px-6 py-4 text-center font-semibold text-primary" href="/orders">{t('orders')}</Link>
   <Link className="px-6 py-4 text-center font-semibold text-primary" href="/support">{t('support')}</Link>
 </section>;
}
