import type {ReactNode} from 'react';
import {Button} from './Button';
import {useLocale} from './Locale';
import type {DirectOrder} from './QuoteCard';
/** Approved desktop287:1507 only. Every detail and amount comes from the owned order. */
export function ApprovedClientDesktopCards({order,primary,onHelp,online,fresh,error}:{order:DirectOrder;primary:ReactNode;onHelp:()=>void;online:boolean;fresh:boolean;error:string}) {
 const {t,formatMoney}=useLocale();
 const workMaterials=order.workPrice!=null&&Number.isFinite(order.workPrice)&&Number.isFinite(order.materialsPrice)?order.workPrice+order.materialsPrice:null;
 const scope=order.workComment?.trim();
 const distinctScope=scope&&scope!==order.description.trim();
 const details=[['addressEntrance',order.entrance],['addressFloor',order.floor],['addressApartment',order.apartment]] as const;
 return <div className="hidden w-full min-w-0 flex-col gap-3 md:flex">
  <section data-approved-desktop-summary className="flex min-w-0 flex-col gap-4 rounded-lg bg-surface p-6">
   <h1 className="break-words text-xl font-semibold leading-[1.4] text-primary">{t('approved')}</h1>
   <p className="rounded-md bg-fill-soft px-4 py-1 text-center text-xs leading-6 text-primary">{t('desktopApprovedStatus')}</p>
   <p data-approved-desktop-note className="text-base leading-6 text-ink">{t('desktopApprovedNote')}</p>
   <dl className="flex flex-col gap-4">
    <div className="flex justify-between gap-4"><dt className="min-w-0 text-sm leading-[21px] text-ink-soft">{t('approvedWorkMaterials')}</dt><dd data-approved-work-materials className="shrink-0 text-right text-base font-semibold leading-[1.4] text-primary">{workMaterials==null?'—':formatMoney(workMaterials)}</dd></div>
    <div className="flex justify-between gap-4"><dt className="min-w-0 text-sm leading-[21px] text-ink-soft">{t('callout')}</dt><dd data-approved-callout className="shrink-0 text-right text-base font-semibold leading-[1.4] text-primary">{formatMoney(order.calloutPrice)}</dd></div>
    <div className="flex justify-between gap-4"><dt className="min-w-0 text-sm leading-[21px] text-ink-soft">{t('total')}</dt><dd data-approved-total className="shrink-0 text-right text-base font-semibold leading-[1.4] text-primary">{order.quoteTotal==null?'—':formatMoney(order.quoteTotal)}</dd></div>
   </dl>
   {online&&!fresh&&<p role="status" className="text-sm text-ink-soft">{t('reconciling')}</p>}
   {!online&&<p role="status" className="rounded-md bg-warning-bg p-3 text-sm text-warning-ink">{t('offline')}</p>}
   {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
   {primary}
  </section>
  <section data-approved-order-details className="flex min-w-0 flex-col gap-4 rounded-lg bg-surface p-6">
   <h2 className="break-words text-xl font-semibold leading-[1.4] text-primary">{t('orderNumber',{id:order.id.slice(0,8)})}</h2>
   {distinctScope&&<section data-approved-desktop-scope className="flex min-w-0 flex-col gap-2"><h3 className="text-sm font-semibold text-primary">{t('agreedScope')}</h3><p className="whitespace-pre-wrap break-words text-base leading-6 text-ink">{order.workComment}</p></section>}
   <div className="min-w-0 whitespace-pre-wrap break-words text-base leading-6 text-ink"><p>{order.description}</p><p>{order.address}</p></div>
   {details.some(([,value])=>value?.trim())&&<p data-approved-address-details className="break-words text-sm leading-[21px] text-ink">{details.filter(([,value])=>value?.trim()).map(([key,value])=>`${t(key)} ${value}`).join(' · ')}</p>}
   <Button variant="white" onClick={onHelp}>{t('help')}</Button>
  </section>
 </div>;
}
