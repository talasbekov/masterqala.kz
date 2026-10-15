import type {ReactNode} from 'react';
import {isKnownQuoteAmount} from './quote-amount';
import {useLocale} from './Locale';
import type {DirectOrder} from './QuoteCard';
import type {CopyKey} from './locale-data';
const states:Record<string,{title:CopyKey;badge:CopyKey;note:CopyKey}>={
 IN_PROGRESS:{title:'working',badge:'workingBadge',note:'clientWorkingNote'},
 CREATED:{title:'searching',badge:'searchStarted',note:'clientSearchNote'},SEARCHING:{title:'searching',badge:'searchStarted',note:'clientSearchNote'},
 ACCEPTED:{title:'assigned',badge:'masterAcceptedBadge',note:'clientFoundNote'},MASTER_ON_WAY:{title:'enroute',badge:'enroute',note:'clientTravelNote'},
 INSPECTION:{title:'inspection',badge:'inspectionBadge',note:'inspectionNote'},NO_MASTERS:{title:'nomatch',badge:'searchFinished',note:'clientNoMasterNote'},
};
export const hasClientUrgentCards=(status:string)=>Object.hasOwn(states,status);
export function ClientUrgentStateCards({order,actions}:{order:DirectOrder;actions:ReactNode}){
 const {t,formatMoney,formatReviews}=useLocale();const state=states[order.status];if(!state)return null;
 const working=order.status==='IN_PROGRESS';const discovery=['CREATED','SEARCHING','NO_MASTERS'].includes(order.status);const master=discovery?null:order.master;
 const name=master?.name?.trim()||null;const details=[['addressEntrance',order.entrance],['addressFloor',order.floor],['addressApartment',order.apartment]] as const;
 return <div className="flex min-w-0 flex-col gap-6 md:gap-4">
  <section data-client-urgent-summary className="flex min-w-0 flex-col gap-6 md:rounded-lg md:bg-surface md:p-6">
   <span data-order-status={order.status} className={`w-fit rounded-md bg-fill-soft px-3 py-2 text-xs font-semibold ${discovery?'text-primary':'text-approved'} ${order.status==='NO_MASTERS'?'hidden md:block':''} md:w-full md:text-center`}>{t(state.badge)}</span>
   <h1 className="break-words text-[28px] font-medium leading-[34px] text-primary md:order-first md:text-xl md:font-semibold md:leading-[1.4]">{t(state.title)}</h1>
   <p data-client-state-guidance className="break-words text-sm leading-[21px] text-ink-soft md:text-base md:leading-6 md:text-ink">{t(state.note)}</p>
   {master&&<div className="flex min-w-0 items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-fill-soft text-2xl font-semibold text-primary">{name?.slice(0,2).toUpperCase()??'—'}</div><div className="min-w-0"><h2 className="break-words text-xl font-semibold text-primary">{name??t('specialist')}</h2><p className="text-sm text-primary">★ {master.rating?.toFixed(1)??'—'} · {master.reviewCount==null?'—':formatReviews(master.reviewCount)}</p>{order.category?.name&&<p className="break-words text-sm text-ink-soft">{order.category.name}</p>}</div></div>}
   {discovery&&order.category?.name&&<p className="break-words text-sm text-primary">{order.category.name}</p>}
   {working&&<><section className="flex flex-col gap-3 rounded-lg bg-fill-soft p-4"><h2 className="text-sm font-semibold text-primary">{t('agreedScope')}</h2><p data-client-agreed-scope className="whitespace-pre-wrap break-words text-sm leading-[21px] text-ink-soft md:text-base md:leading-6">{order.workComment?.trim()?order.workComment:order.description}</p></section><dl className="flex flex-col gap-4"><div className="hidden justify-between gap-4 text-sm md:flex"><dt className="text-ink-soft">{t('approvedWorkMaterials')}</dt><dd className="font-semibold text-primary">{isKnownQuoteAmount(order.workPrice)&&isKnownQuoteAmount(order.materialsPrice)&&isKnownQuoteAmount(order.workPrice+order.materialsPrice)?formatMoney(order.workPrice+order.materialsPrice):'—'}</dd></div><div className="flex justify-between gap-4 text-sm"><dt className="text-ink-soft">{t('total')}</dt><dd data-client-working-total className="font-semibold text-primary">{isKnownQuoteAmount(order.quoteTotal)?formatMoney(order.quoteTotal):'—'}</dd></div></dl><section data-client-after-work className="flex flex-col gap-3 rounded-lg bg-fill-soft p-4 md:hidden"><h2 className="text-sm font-semibold text-primary">{t('afterWork')}</h2><p className="text-sm leading-[21px] text-ink-soft">{t('clientAfterWorkNote')}</p></section></>}
   {order.status!=='NO_MASTERS'&&<dl className="hidden justify-between gap-4 text-sm md:flex"><dt className="text-ink-soft">{t('callout')}</dt><dd className="font-semibold text-primary">{order.quoteVersion>0?(isKnownQuoteAmount(order.calloutPrice)?formatMoney(order.calloutPrice):'—'):t('moneyUnknown')}</dd></dl>}
   <div className="hidden flex-col gap-2 md:flex">{actions}</div>
  </section>
  <section data-client-request className="flex min-w-0 flex-col gap-3 rounded-lg bg-fill-soft p-4 md:bg-surface md:p-6">
   <h2 className="break-words text-sm font-semibold text-primary md:text-xl">{t('orderNumber',{id:order.id.slice(0,8)})}</h2>
   <p className="whitespace-pre-wrap break-words text-sm leading-[21px] text-ink-soft md:text-base md:leading-6 md:text-ink">{order.description}</p>
   <p className="break-words text-sm leading-[21px] text-primary md:text-base md:leading-6">{order.address}</p>
   {details.some(([,value])=>value?.trim())&&<p className="break-words text-sm leading-[21px] text-primary">{details.filter(([,value])=>value?.trim()).map(([key,value])=>`${t(key)} ${value}`).join(' · ')}</p>}
   {order.cancellationAmount!=null&&<p className="font-semibold text-primary">{t('cancelAmount')}: {formatMoney(order.cancellationAmount)}</p>}
  </section>
 </div>;
}
