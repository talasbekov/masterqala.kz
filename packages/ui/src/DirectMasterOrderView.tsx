'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from './Button';
import {useLocale,LanguageSelector} from './Locale';
import {QuoteCard,type DirectOrder} from './QuoteCard';
import type {CopyKey} from './locale-data';
const titles:Record<string,CopyKey>={ACCEPTED:'assigned',MASTER_ON_WAY:'enroute',INSPECTION:'newQuote',AWAITING_PRICE_CONFIRM:'waiting',PRICE_APPROVED:'ready',IN_PROGRESS:'working',DONE:'waitingAcceptance',CLOSED:'closed',CANCELLED_BY_CLIENT:'cancelled'};
function validQuoteVersion(value:unknown):value is number{return typeof value==='number'&&Number.isInteger(value)&&value>=0;}
function snapshotQuote(order:DirectOrder){return {id:order.id,version:validQuoteVersion(order.quoteVersion)?order.quoteVersion:null,work:order.workPrice?.toString()??'',materials:order.materialsPrice?.toString()??'',callout:order.quoteVersion>0?order.calloutPrice?.toString()??'':'',comment:order.workComment??''};}
export function DirectMasterOrderView({order,busy,error,online,fresh,onAction,onBack,onHelp,onRefresh}:{order:DirectOrder;busy:boolean;error:string;online:boolean;fresh:boolean;onAction:(action:string,body?:object)=>Promise<boolean>;onBack:()=>void;onHelp:()=>void;onRefresh?:()=>Promise<void>}) {
  const {t,formatMoney}=useLocale();
  const[editing,setEditing]=useState(false),[draft,setDraft]=useState(()=>snapshotQuote(order));
  const {work,materials,callout,comment}=draft;
  const canPropose=order.status==='INSPECTION'||editing&&['AWAITING_PRICE_CONFIRM','PRICE_APPROVED'].includes(order.status);
  const draftConflict=!canPropose||draft.id!==order.id||draft.version===null||!validQuoteVersion(order.quoteVersion)||draft.version!==order.quoteVersion;
  const form=order.status==='INSPECTION'||editing;
  const numbers=[Number(work),Number(materials),Number(callout)],sum=numbers.reduce((a,b)=>a+b,0);
  const valid=work!==''&&materials!==''&&callout!==''&&numbers.every(n=>Number.isInteger(n)&&n>=0)&&numbers[0]>0&&sum<=2147483647;
  const mounted=useRef(false),pendingRefresh=useRef<{id:string}|null>(null);
  const[refreshRequest,setRefreshRequest]=useState<{id:string}|null>(null),[refreshFailure,setRefreshFailure]=useState<{id:string;message:string}|null>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pendingRefresh.current=null;};},[]);
  const refreshing=refreshRequest?.id===order.id;
  const disabled=busy||!online||!fresh||refreshing;
  async function refresh(){
    if(!onRefresh||busy||!online||pendingRefresh.current?.id===order.id)return;
    const request={id:order.id};pendingRefresh.current=request;setRefreshRequest(request);setRefreshFailure(null);
    try{await onRefresh();}catch(e){if(mounted.current&&pendingRefresh.current===request)setRefreshFailure({id:request.id,message:(e as Error).message});}
    finally{if(pendingRefresh.current===request){pendingRefresh.current=null;if(mounted.current)setRefreshRequest(null);}}
  }
  const approved=order.status==='PRICE_APPROVED';
  const clientName=order.client?.name?.trim();
  function beginEdit(){if(disabled)return;setDraft(snapshotQuote(order));setEditing(true);}
  function reloadDraft(){if(disabled||!canPropose||!validQuoteVersion(order.quoteVersion))return;setDraft(snapshotQuote(order));}
  async function send(){if(disabled||!valid||draftConflict)return;if(await onAction('propose-price',{amount:numbers[0],materialsPrice:numbers[1],calloutPrice:numbers[2],comment,expectedQuoteVersion:draft.version}))setEditing(false);}
  const actions = form?<Button data-action="send-quote" disabled={disabled||!valid||draftConflict} loading={busy} onClick={()=>void send()}>{t('sendQuote',{amount:formatMoney(sum)})}</Button>:
    order.status==='ACCEPTED'?<Button disabled={disabled} loading={busy} onClick={()=>void onAction('on-way')}>{t('onway')}</Button>:
    order.status==='MASTER_ON_WAY'?<Button disabled={disabled} loading={busy} onClick={()=>void onAction('on-site')}>{t('onsite')}</Button>:
    order.status==='PRICE_APPROVED'?<Button data-action="start-work" className="min-h-[56px] md:min-h-[52px]" disabled={disabled} loading={busy} onClick={()=>void onAction('start-work',{quoteVersion:order.quoteVersion})}>{t('start')}</Button>:
    order.status==='IN_PROGRESS'?<Button disabled={disabled} loading={busy} onClick={()=>void onAction('complete')}>{t('complete')}</Button>:
    ['AWAITING_PRICE_CONFIRM','DONE'].includes(order.status)&&onRefresh?<Button data-action="refresh-status" variant="secondary" className="min-h-[56px] md:min-h-[52px]" disabled={busy||!online||refreshing} loading={refreshing} onClick={()=>void refresh()}>{t(refreshing?'refreshStatusBusy':'refreshStatus')}</Button>:null;
  return <div className="flex min-h-screen flex-col bg-surface md:min-h-screen md:bg-fill-soft">
    <header className="flex min-h-14 items-center gap-3 px-4 md:bg-surface md:p-6"><button onClick={onBack} aria-label={t('back')} className="flex h-11 w-11 items-center justify-center md:hidden"><img src="/mq/back.svg" alt="" width={24} height={24}/></button><p className="flex-1 text-center font-semibold text-primary md:text-left md:text-sm md:font-normal">{t('orderNumber',{id:order.id.slice(0,8)})}</p><span className="hidden md:block"><LanguageSelector/></span><button onClick={onHelp} aria-label={t('help')} className="h-11 w-11 text-primary md:hidden">?</button></header>
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-6 md:p-10 md:pt-8">
      <span data-master-status className={`w-fit rounded-md bg-fill-soft px-3 py-2 text-xs font-semibold md:hidden ${approved?'text-approved':'text-primary'}`}>{order.status==='PRICE_APPROVED'?t('confirmed'):t(titles[order.status]??'order')}</span>
      <h1 className="text-[28px] font-medium leading-[34px] text-primary md:text-[32px] md:font-semibold">{form?t('newQuote'):t(titles[order.status]??'order')}</h1>
      {approved&&!form&&<p data-approved-explanation className="break-words text-sm leading-[21px] text-ink-soft">{t(clientName?'masterApprovedNamed':'masterApprovedGeneric',{name:clientName??'',amount:formatMoney(order.quoteTotal??0)})}</p>}
      {form&&<p className="text-sm leading-[21px] text-ink-soft">{t('newQuoteNote')}</p>}
      {order.status==='DONE'&&<p className="text-sm leading-[21px] text-ink-soft">{t('waitingNote')}</p>}
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6 md:rounded-lg md:bg-surface md:p-6">
          {form&&<><div className="flex flex-col gap-6">{(['work','materials','callout'] as const).map((key,i)=><label key={key} className="flex flex-col gap-2 rounded-md border border-border p-4"><span className="text-xs font-semibold text-ink-soft">{t(key)} · ₸</span><input aria-label={t(key)} inputMode="numeric" type="number" min={i===0?1:0} max={2147483647} value={[work,materials,callout][i]} disabled={busy||refreshing} onChange={event=>{const value=event.target.value;setDraft(previous=>({...previous,[key]:value}));}} className="min-h-8 w-full bg-transparent text-base text-ink outline-none"/></label>)}</div><label className="flex flex-col gap-2 text-sm text-ink-soft">{t('comment')}<textarea maxLength={1000} rows={3} value={comment} disabled={busy||refreshing} onChange={event=>{const value=event.target.value;setDraft(previous=>({...previous,comment:value}));}} className="rounded-md border border-border p-4 text-ink"/></label>{editing&&<p className="text-sm text-warning-ink">{t('quoteChanges')}</p>}</>}
          {form&&draftConflict&&<section data-quote-draft-conflict className="flex flex-col gap-3 rounded-md bg-warning-bg p-4"><p role="alert" className="text-sm leading-[21px] text-warning-ink">{t(validQuoteVersion(order.quoteVersion)?'quoteDraftConflict':'quoteDraftVersionUnavailable')}</p><Button data-action="reload-quote-draft" variant="secondary" disabled={disabled||!canPropose||!validQuoteVersion(order.quoteVersion)} onClick={reloadDraft}>{t('reloadQuoteDraft')}</Button></section>}
          {onRefresh&&(form||approved)&&(!fresh||form&&!validQuoteVersion(order.quoteVersion))&&<Button data-action="refresh-quote-version" variant="secondary" disabled={busy||!online||refreshing} loading={refreshing} onClick={()=>void refresh()}>{t(refreshing?'refreshStatusBusy':'refreshStatus')}</Button>}
          {editing&&<Button data-action="cancel-quote-edit" variant="secondary" disabled={busy||refreshing} onClick={()=>setEditing(false)}>{t('cancelQuoteEdit')}</Button>}
          {(order.quoteVersion>0||form)&&<QuoteCard order={form?{...order,workPrice:numbers[0],materialsPrice:numbers[1],calloutPrice:numbers[2],quoteTotal:sum,workComment:comment}:approved?{...order,workComment:order.workComment?.trim()?order.workComment:order.description}:order}/>}
          {!form&&<section data-agreed-scope={approved||undefined} className="rounded-lg bg-fill-soft p-4"><h2 className={approved?'text-sm font-semibold leading-[1.3] text-primary':'font-semibold text-primary'}>{t(approved?'agreedScope':'scope')}</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-[21px] text-ink-soft">{order.workComment??order.description}</p>{approved&&<p data-additional-consent className="break-words text-sm leading-[21px] text-ink-soft">{t('additionalConsent')}</p>}<p className="mt-3 break-words text-sm text-primary">{order.address}</p></section>}
          {approved&&!form&&<Button data-action="revise-approved-quote" className="md:hidden" variant="secondary" disabled={disabled} onClick={beginEdit}>{t('editQuote')}</Button>}
          {online&&!fresh&&<p role="status" className="text-sm text-ink-soft">{t('reconciling')}</p>}
        {!online&&<p role="status" className="rounded-md bg-warning-bg p-3 text-sm text-warning-ink">{t('offline')}</p>}{(error||refreshFailure?.id===order.id)&&<p role="alert" className="text-sm text-danger">{error||(refreshFailure?.id===order.id?refreshFailure.message:'')}</p>}
          <div className="hidden flex-col gap-2 md:flex">{actions}{['AWAITING_PRICE_CONFIRM','PRICE_APPROVED'].includes(order.status)&&!editing&&<Button variant="secondary" disabled={disabled} onClick={beginEdit}>{t('editQuote')}</Button>}</div>
        </div>
        <aside className="hidden w-[340px] shrink-0 space-y-4 rounded-lg bg-surface p-6 md:block"><h2 className="text-xl font-semibold text-primary">{order.client?.name}</h2><p className="text-sm leading-relaxed text-ink-soft">{t('quoteNote')}</p>{order.client?.phone&&<a href={`tel:${order.client.phone}`} className="flex min-h-[52px] items-center justify-center rounded-md bg-fill-soft px-4 font-semibold text-primary">{t('callClient')}</a>}<Button className="w-full" variant="secondary" onClick={onHelp}>{t('help')}</Button></aside>
      </div>
    </main>
    <footer className="sticky bottom-0 z-10 flex flex-col gap-2 bg-surface px-6 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:hidden">{actions}{order.status==='AWAITING_PRICE_CONFIRM'&&!editing&&<Button variant="secondary" disabled={disabled} onClick={beginEdit}>{t('editQuote')}</Button>}{order.client?.phone&&<a href={`tel:${order.client.phone}`} className="flex min-h-14 items-center justify-center rounded-md bg-fill-soft font-semibold text-primary">{t('callClient')}</a>}{(!approved||form)&&<Button variant="white" onClick={onHelp}>{t('help')}</Button>}</footer>
  </div>;
}
