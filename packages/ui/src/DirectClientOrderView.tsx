'use client';
import {useState,type ReactNode} from 'react';
import {ClientUrgentStateCards,hasClientUrgentCards} from './ClientUrgentStateCards';
import {ApprovedClientDesktopCards} from './ApprovedClientDesktopCards';
import {Dialog} from './Dialog';
import {Button} from './Button';
import {useLocale,LanguageSelector} from './Locale';
import {QuoteCard,type DirectOrder} from './QuoteCard';
import type {CopyKey} from './locale-data';
const titles:Record<string,CopyKey>={CREATED:'searching',SEARCHING:'searching',ACCEPTED:'assigned',MASTER_ON_WAY:'enroute',INSPECTION:'inspection',AWAITING_PRICE_CONFIRM:'quote',PRICE_APPROVED:'approved',IN_PROGRESS:'working',DONE:'done',CLOSED:'closed',NO_MASTERS:'nomatch',CANCELLED_BY_CLIENT:'cancelled',CANCELLED_BY_MASTER:'cancelled'};
export interface CancellationPreview {amount:number;expectedUpdatedAt:string;}
export function DirectClientOrderView({order,busy,error,online,fresh,onAction,onCancelPreview,onBack,onHelp,onHome,map}:{order:DirectOrder;busy:boolean;error:string;online:boolean;fresh:boolean;onAction:(action:string,body?:object)=>Promise<boolean>;onCancelPreview:()=>Promise<CancellationPreview>;onBack:()=>void;onHelp:()=>void;onHome?:()=>void;map?:ReactNode}) {
  const{t,formatMoney,formatReviews}=useLocale();
  const[helpOpen,setHelpOpen]=useState(false);
  const[rating,setRating]=useState(0),[reviewComment,setReviewComment]=useState('');
  const[preview,setPreview]=useState<CancellationPreview|null>(null),[previewError,setPreviewError]=useState(''),[fetching,setFetching]=useState(false);
  const disabled=busy||!online||!fresh;
  const masterPhone=order.master?.phone?.trim();
  const quote=order.status==='AWAITING_PRICE_CONFIRM',approved=order.status==='PRICE_APPROVED',working=order.status==='IN_PROGRESS',closed=order.status==='CLOSED';
  const urgent=hasClientUrgentCards(order.status),searching=['CREATED','SEARCHING'].includes(order.status);
  const canCancel=['CREATED','SEARCHING','NO_MASTERS','ACCEPTED','MASTER_ON_WAY','INSPECTION','AWAITING_PRICE_CONFIRM','PRICE_APPROVED'].includes(order.status);
  async function requestCancel(){if(fetching||disabled)return;setFetching(true);setPreviewError('');try{setPreview(await onCancelPreview());setHelpOpen(false);}catch(e){setPreviewError((e as Error).message);}finally{setFetching(false);}}
  const primary = searching?<Button data-action="cancel-search" variant="secondary" className="min-h-[56px] md:min-h-[52px] md:bg-primary md:text-white" disabled={disabled||fetching} loading={fetching} onClick={()=>void requestCancel()}>{t('cancelSearch')}</Button>:quote?<Button data-action="approve-quote" className="min-h-[56px] md:min-h-[52px]" disabled={disabled||order.quoteTotal==null} loading={busy} onClick={()=>void onAction('confirm-price',{quoteVersion:order.quoteVersion})}>{order.quoteTotal==null?t('approveUnknown'):t('approve',{amount:formatMoney(order.quoteTotal)})}</Button>:
    order.status==='DONE'?<Button data-action="accept-work" className="min-h-[56px] md:min-h-[52px]" disabled={disabled} loading={busy} onClick={()=>void onAction('confirm-completion')}>{t('accept')}</Button>:
    closed&&onHome?<Button data-action="go-home" className="min-h-[56px] md:min-h-[52px]" onClick={onHome}>{t('homeDestination')}</Button>:
    order.status==='NO_MASTERS'?<Button data-action="retry-search" className="min-h-[56px] md:min-h-[52px]" disabled={disabled} loading={busy} onClick={()=>void onAction('retry-search')}>{t('retry')}</Button>:
    masterPhone&&!['CREATED','SEARCHING','NO_MASTERS'].includes(order.status)?<a className={`flex min-h-14 items-center justify-center rounded-md bg-primary px-4 py-3 text-center font-semibold text-white ${approved?'md:min-h-[52px]':''}`} href={`tel:${masterPhone}`}>{t('call')}</a>:null;
  return <div className="relative flex min-h-screen flex-col bg-surface md:min-h-screen md:bg-fill-soft">
    <div className="absolute inset-0 hidden md:block">{map}</div>
    <header className="relative flex min-h-14 items-center gap-3 px-4 md:mx-4 md:mt-4 md:h-[76px] md:justify-between md:rounded-lg md:bg-primary md:px-6 md:text-white">
      <button onClick={onBack} aria-label={t('back')} className="flex h-11 w-11 shrink-0 items-center justify-center md:hidden"><img src="/mq/back.svg" alt="" width={24} height={24}/></button>
      <span className="flex-1 text-center font-semibold text-primary md:flex-none md:text-left md:text-[28px] md:text-white"><span className="md:hidden">{closed?t('orderNumber',{id:order.id.slice(0,8)}):t(quote?'quoteCost':'order')}</span><span className="hidden md:inline">MasterQala</span></span>
      <div className="hidden items-center gap-8 md:flex"><Button variant="white" onClick={()=>setHelpOpen(true)}>{t('support')}</Button><LanguageSelector/><button className="min-h-11 font-medium" onClick={onBack}>{t('orders')}</button></div>
      <button aria-label={t('help')} onClick={()=>setHelpOpen(true)} className="h-11 w-11 text-primary md:hidden">?</button>
    </header>
    <div className={`relative flex flex-1 flex-col md:mx-4 md:mt-5 ${approved||urgent&&order.status!=='NO_MASTERS'?'gap-6 lg:flex-row lg:items-start':'md:max-w-[400px]'}`}>
      <div className="flex min-w-0 flex-1 flex-col md:max-w-[400px]"><main className={`flex flex-1 flex-col gap-6 p-6 ${approved?'md:hidden':urgent?'md:p-0':'md:rounded-lg md:bg-surface'}`}>
        {urgent?<ClientUrgentStateCards order={order} actions={<>{primary}<Button variant="secondary" onClick={()=>setHelpOpen(true)}>{t('help')}</Button></>}/>:<>
        <div className="flex items-center justify-between gap-3"><span data-order-status={order.status} className={`rounded-md bg-fill-soft px-3 py-2 text-xs font-semibold ${approved||closed?'text-approved':'text-primary'}`}>{quote?t('pending'):closed?t('closedBadge'):approved?t('approvedBadge',{amount:formatMoney(order.quoteTotal??0)}):t(titles[order.status]??'order')}</span></div>
        <h1 className="break-words text-[28px] font-medium leading-[34px] text-primary md:text-xl md:font-semibold">{t(closed?'closedThanks':titles[order.status]??'order')}</h1>
        {quote&&<p data-quote-introduction className="whitespace-pre-wrap break-words text-sm leading-[21px] text-ink-soft md:hidden">{order.workComment?.trim()?order.workComment:order.description} {t('quoteConsentStartNote')}</p>}
        {approved&&<p className="text-sm leading-[21px] text-ink-soft">{t('approvedNote')}</p>}
        {order.status==='INSPECTION'&&<p className="text-sm leading-[21px] text-ink-soft">{t('inspectionNote')}</p>}
        {order.status==='DONE'&&<><p className="text-sm leading-[21px] text-ink-soft">{t('doneNote')}</p><p data-acceptance-guidance className="text-sm leading-[21px] text-ink-soft">{t('acceptanceGuidance')}</p><div data-acceptance-quote><QuoteCard order={{...order,workComment:order.workComment?.trim()?order.workComment:order.description}}/></div><p data-acceptance-payment className="text-sm leading-[21px] text-ink-soft">{t('quoteNote')}</p></>}
        {closed&&<><p className="text-sm leading-[21px] text-ink-soft">{t('closedSummaryNote')}</p><div data-closed-quote><QuoteCard order={{...order,workComment:order.workComment?.trim()?order.workComment:order.description}}/></div></>}
        {closed&&(order.review?<p role="status">{t('reviewThanks')}</p>:<section className="flex flex-col gap-3 rounded-lg bg-fill-soft p-4"><h2 className="font-semibold text-primary">{t('rating')}</h2><div className="flex" role="group" aria-label={t('rating')}>{[1,2,3,4,5].map(value=><button key={value} aria-label={String(value)} aria-pressed={rating===value} disabled={disabled} onClick={()=>setRating(value)} className={`h-12 w-12 text-[28px] ${value<=rating?'text-primary':'text-muted'}`}>★</button>)}</div><textarea aria-label={t('review')} placeholder={t('review')} maxLength={1000} value={reviewComment} onChange={event=>setReviewComment(event.target.value)} className="rounded-md border border-border bg-surface p-3"/><Button data-action="submit-review" disabled={disabled||rating===0} loading={busy} onClick={()=>void onAction('review',{rating,comment:reviewComment||undefined})}>{t('sendReview')}</Button></section>)}
        {quote&&<QuoteCard order={{...order,workComment:order.workComment?.trim()?order.workComment:order.description}}/>}
        {order.master&&<div className="flex items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-fill-soft text-2xl font-semibold text-primary">{order.master.name?.slice(0,2).toUpperCase()??'—'}</div><div className="min-w-0"><h2 className="break-words text-xl font-semibold text-primary">{order.master.name}</h2><p className="text-sm text-primary">★ {order.master.rating?.toFixed(1)??'—'} · {formatReviews(order.master.reviewCount??0)}</p><p className="text-xs text-ink-soft">{order.category?.name}</p></div></div>}
        {closed&&<section data-closed-payment className="flex flex-col gap-3 rounded-lg bg-fill-soft p-4"><h2 className="text-sm font-semibold text-primary">{t('closedPaymentTitle')}</h2><p className="text-sm leading-[21px] text-ink-soft">{t('closedPaymentNote',{amount:order.quoteTotal==null?'—':formatMoney(order.quoteTotal)})}</p></section>}
        {closed&&masterPhone&&<a data-action="call-closed-master" href={`tel:${masterPhone}`} className="flex min-h-[56px] items-center justify-center rounded-md bg-fill-soft px-4 py-3 text-center font-semibold text-primary md:min-h-[52px]">{t('call')}</a>}
        {(approved||working)&&<><section className="rounded-lg bg-fill-soft p-4"><h2 className="font-semibold text-primary">{t('scope')}</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-[21px] text-ink-soft">{order.workComment??order.description}</p></section><div data-quote-total className="flex items-center gap-3 rounded-lg bg-surface p-4"><img src="/mq/quote-total.svg" alt="" width={24} height={24}/><div className="flex min-w-0 flex-1 flex-col gap-1"><p data-total-caption className="text-xs font-semibold leading-4 text-ink-soft">{t('total')}</p><p data-total-amount className="text-sm font-semibold leading-[1.3] text-primary">{formatMoney(order.quoteTotal??0)}</p></div></div></>}
        {!quote&&!approved&&!working&&<section className="rounded-lg bg-fill-soft p-4"><p className="break-words text-sm text-ink-soft">{order.description}</p><p className="mt-2 break-words text-sm text-primary">{order.address}</p>{order.cancellationAmount!=null&&<p className="mt-3 font-semibold text-primary">{t('cancelAmount')}: {formatMoney(order.cancellationAmount)}</p>}</section>}
        {quote&&<p className="text-sm leading-[21px] text-ink-soft">{t('quoteNote')}</p>}
        </>}
        {online&&!fresh&&<p role="status" className="text-sm text-ink-soft">{t('reconciling')}</p>}
        {!online&&<p role="status" className="rounded-md bg-warning-bg p-3 text-sm text-warning-ink">{t('offline')}</p>}
        {(error||previewError)&&<p role="alert" className="text-sm text-danger">{error||previewError}</p>}
        <div className={`hidden flex-col gap-2 ${urgent?'':'md:flex'}`}>{primary}<Button data-action={order.status==='DONE'?'report-problem':undefined} variant="secondary" onClick={order.status==='DONE'?onHelp:()=>setHelpOpen(true)}>{t(order.status==='DONE'?'problem':'help')}</Button></div>
      </main>
      {approved&&<ApprovedClientDesktopCards order={order} primary={primary} onHelp={()=>setHelpOpen(true)} online={online} fresh={fresh} error={error||previewError}/>}
      <footer className="sticky bottom-0 z-10 flex flex-col gap-2 bg-surface px-6 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:hidden">{primary}{closed&&onHome?<Button data-action="open-orders" variant="secondary" className="min-h-[56px]" onClick={onBack}>{t('orders')}</Button>:quote?(masterPhone?<a data-action="discuss-quote" href={`tel:${masterPhone}`} className="flex min-h-[56px] items-center justify-center rounded-md bg-fill-soft px-4 py-3 text-center font-semibold text-primary">{t('discussCost')}</a>:<Button data-action="discuss-quote" variant="secondary" className="min-h-[56px]" onClick={onHelp}>{t('discussCostSupport')}</Button>):<Button data-action={order.status==='DONE'?'report-problem':undefined} variant="secondary" className="min-h-[56px]" onClick={order.status==='DONE'?onHelp:()=>setHelpOpen(true)}>{t(order.status==='DONE'?'problem':'help')}</Button>}</footer>
    </div>
      {urgent&&order.status!=='NO_MASTERS'&&<aside data-client-cost-notice className="hidden w-full max-w-[400px] rounded-lg bg-surface p-6 md:block lg:ml-auto lg:w-[330px] lg:shrink-0"><h2 className="text-xl font-semibold leading-[1.4] text-primary">{t('costControl')}</h2><p className="mt-4 text-base leading-6 text-ink-soft">{t(working?'approvedChangeNote':'costControlNote')}</p>{working&&<p className="mt-4 text-base leading-6 text-ink-soft">{t('clientAfterWorkNote')}</p>}</aside>}
      {approved&&<aside data-approved-notice className="hidden w-full max-w-[400px] rounded-lg bg-surface p-6 md:block lg:ml-auto lg:w-[330px] lg:shrink-0"><h2 className="text-xl font-semibold leading-[1.4] text-primary">{t('approved')}</h2><p className="mt-4 text-base leading-6 text-ink-soft">{t('approvedChangeNote')}</p></aside>}
    </div>
    <Dialog open={helpOpen} title={t('help')} busy={fetching} onClose={()=>setHelpOpen(false)}>
      <h2 className="text-xl font-semibold text-primary">{t('help')}</h2>
      <Button variant="secondary" onClick={onHelp}>{t('support')}</Button>
      {canCancel&&<Button variant="secondary" disabled={disabled||fetching} onClick={()=>void requestCancel()}>{t('cancel')}</Button>}
      <Button variant="white" onClick={()=>setHelpOpen(false)}>{t('stay')}</Button>
    </Dialog>
    <Dialog open={preview!==null} title={t('cancel')} busy={busy} onClose={()=>setPreview(null)}>
      <h2 className="text-xl font-semibold text-primary">{t('cancel')}</h2>
      <p className="text-sm leading-relaxed text-ink-soft">{preview?.amount===0?t('freeCancel'):t('paidCancel',{amount:formatMoney(preview?.amount??0)})}</p>
      <Button variant="danger" disabled={disabled} onClick={async()=>{if(!preview)return;if(await onAction('cancel',{expectedAmount:preview.amount,expectedUpdatedAt:preview.expectedUpdatedAt}))setPreview(null);}}>{t('confirmCancel')}</Button>
      <Button variant="secondary" disabled={busy} onClick={()=>setPreview(null)}>{t('stay')}</Button>
    </Dialog>
  </div>;
}
