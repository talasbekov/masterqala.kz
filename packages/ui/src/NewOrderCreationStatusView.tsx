'use client';
import {Button} from './Button';
import {useLocale} from './Locale';
import type {ReactNode} from 'react';
export function NewOrderCreationStatusView({persistent,submitting,completedOrderId,error,onRecover,online=true,recovering=false,renderLink}:{renderLink:(href:string,className:string,label:string)=>ReactNode;pending:boolean;persistent:boolean;submitting:boolean;completedOrderId:string|null;error:string;onRecover?:()=>void;online?:boolean;recovering?:boolean}) {
 const {t}=useLocale();
 return <section className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 px-6 py-8">
   <h1 className="text-2xl font-semibold text-ink" aria-live="polite">{completedOrderId?t('createOutcomeConfirmed'):submitting?t(recovering?'checkSubmissionBusy':'submitBusy'):t('createOutcomeUnknown')}</h1>
   {!completedOrderId&&<p className="text-base leading-6 text-ink-soft">{t(onRecover?'createOutcomeKeyedHelp':'createOutcomeHelp')}</p>}
   {!completedOrderId&&!persistent&&<p role="alert" className="text-sm text-danger">{t('createOutcomeStorage')}</p>}
   {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
   {!completedOrderId&&onRecover&&<Button onClick={onRecover} loading={submitting} disabled={submitting||!online} fullWidth>{t(submitting&&recovering?'checkSubmissionBusy':'checkSubmission')}</Button>}
   {completedOrderId&&renderLink(`/order/${encodeURIComponent(completedOrderId)}`,"rounded-pill bg-primary px-6 py-4 text-center font-semibold text-white",t('openCreatedOrder'))}
   {renderLink("/orders","rounded-pill border border-primary px-6 py-4 text-center font-semibold text-primary",t('orders'))}
   {renderLink("/support","px-6 py-4 text-center font-semibold text-primary",t('support'))}
 </section>;
}
