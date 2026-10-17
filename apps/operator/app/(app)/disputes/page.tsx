'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Button,useLocale} from '@masterqala/ui';
import {useAuth} from '@/lib/auth';
import {useOperatorDisputeReads,useOperatorResolution} from '@/lib/operator-dispute-controller';
import {disputeText,disputeDate} from '@/lib/operator-dispute-copy';
import {VerificationDocument} from '@/components/VerificationDocument';
import type {DisputeStatus} from '@/lib/disputes';

const images=new Set(['image/jpeg','image/png']);
const card='rounded-2xl bg-white p-6 min-w-0 break-words';
type Filter=DisputeStatus|'ALL';
function readLocation(){
 const query=new URLSearchParams(window.location.search),id=query.get('id'),status=query.get('status');
 return {id:id&&/^[a-zA-Z0-9-]{1,128}$/.test(id)?id:null,status:(status==='RESOLVED'||status==='ALL'?status:'OPEN') as Filter};
}
export default function DisputesPage(){const {user}=useAuth();return <Disputes key={user?.id??'anonymous'} ownerId={user?.id??null}/>;}
function Disputes({ownerId}:{ownerId:string|null}){
 const {language}=useLocale(),t=(key:Parameters<typeof disputeText>[1])=>disputeText(language,key),date=(value:string|null)=>disputeDate(language,value);
 const [status,setStatus]=useState<Filter>('OPEN'),[selected,setSelected]=useState<string|null>(null),[locationReady,setLocationReady]=useState(false);
 const [document,setDocument]=useState<{path:string;id:string;generation:number;valid:()=>boolean}|null>(null);
 useEffect(()=>{const sync=()=>{const next=readLocation();setStatus(next.status);setSelected(next.id);setDocument(null);setLocationReady(true);};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
 function navigate(id:string|null,filter:Filter=status){const url=new URL(window.location.href);if(id)url.searchParams.set('id',id);else url.searchParams.delete('id');url.searchParams.set('status',filter);window.history.pushState(null,'',url);setStatus(filter);setSelected(id);setDocument(null);}
 const {list,detail,order}=useOperatorDisputeReads({ownerId:locationReady?ownerId:null,disputeId:selected,status});
 const resolution=useOperatorResolution({ownerId,disputeId:selected,detail,order,onReconciled:id=>{if(id===selected){void detail.retry();void order.retry();}void list.retry();}});
 const data=detail.data,related=order.data;
 const documentCurrent=()=>!!document&&document.id===selected&&document.generation===detail.readGeneration&&document.valid()&&!!detail.data?.evidenceDocIds.includes(document.path);
 const amount=(value:number|null|undefined)=>value==null?'—':`${new Intl.NumberFormat(({ru:'ru-RU',kk:'kk-KZ',en:'en-GB'})[language]).format(value)} ₸`;
 const boolean=(value:boolean|null)=>value===null?t('unknownValue'):value?t('yes'):t('no');
 const refreshDetail=()=>{setDocument(null);resolution.back();void detail.retry();void order.retry();};
 const orderHref=data?.orderId?`/orders?type=URGENT&id=${encodeURIComponent(data.orderId)}`:data?.plannedOrderId?`/orders?type=PLANNED&id=${encodeURIComponent(data.plannedOrderId)}`:null;
 const readState=(read:typeof detail|typeof list|typeof order)=><>{read.loading&&<p role="status">{t('loading')}</p>}{read.error&&<p role="alert" className="text-red-800">{t('error')}</p>}{read.data&&!read.fresh&&<p role="status">{t('stale')}</p>}</>;
 return <div className="min-h-full space-y-6 bg-[#f4f3ef] p-4 text-base leading-6 text-[#123b52] md:p-8">
  <header className="flex flex-wrap items-center justify-between gap-4">
   <div><h1 className="text-[32px] font-semibold leading-10">{t('title')}</h1><p className="mt-2 text-slate-600">{t('subtitle')}</p></div>
   <label className="flex items-center gap-3 font-medium">{t('status')}<select aria-label={t('status')} value={status} onChange={event=>navigate(null,event.target.value as Filter)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 focus-visible:outline-2 focus-visible:outline-[#123b52]">{(['OPEN','RESOLVED','ALL'] as const).map(value=><option key={value} value={value}>{t(value==='OPEN'?'open':value==='RESOLVED'?'resolved':'all')}</option>)}</select></label>
  </header>
  <section className={card} aria-label={t('title')}>
   <div className="flex flex-wrap items-center justify-between gap-4"><div>{readState(list)}</div><Button variant="secondary" disabled={list.loading} onClick={()=>void list.retry()}>{t('retry')}</Button></div>
   {list.fresh&&list.data?.length===0&&<p className="py-8 text-center text-slate-600">{t('empty')}</p>}
   <div className="operator-dispute-table mt-4 overflow-x-auto"><table className="w-full text-left"><thead><tr>{['ID',t('context'),t('statement'),t('status'),t('date')].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{list.data?.map(row=><tr key={row.id} className={selected===row.id?'bg-fill-soft':''}>
    <td><button data-dispute-select type="button" aria-pressed={selected===row.id} disabled={!list.fresh} onClick={()=>{if(list.isVerifiedCurrent())navigate(row.id);}} className="break-all disabled:opacity-60">{row.id}</button></td>
    <td><p>{t(row.orderId?'urgent':row.plannedOrderId?'planned':'unknownOrder')}</p><p className="break-all text-xs text-ink-soft">{row.orderId??row.plannedOrderId??'-'}</p></td>
    <td>{t(row.openedByRole==='CLIENT'?'client':'master')}</td><td><span className="inline-block rounded-xl bg-fill-soft px-3 py-1 text-xs text-primary">{t(row.status==='OPEN'?'open':'resolved')}</span></td><td>{date(row.createdAt)}</td>
   </tr>)}</tbody></table></div>
  </section>
  {!selected&&<div className={`${card} py-12 text-center text-slate-600`}>{t('select')}</div>}
  {selected&&<>
   <section className={`${card} flex flex-wrap items-center justify-between gap-4`}><div><p className="break-all font-medium">{selected}</p>{readState(detail)}</div><Button variant="secondary" disabled={detail.loading} onClick={refreshDetail}>{t('retry')}</Button></section>
   {data&&<div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="min-w-0 space-y-6">
     <section className={card}><h2 className="text-xl font-semibold">{t('statement')} · {t(data.openedByRole==='CLIENT'?'client':'master')}</h2><p className="mt-4 whitespace-pre-wrap">{data.reason}</p><h3 className="mt-6 font-semibold">{t('reply')}</h3><p className="mt-3 whitespace-pre-wrap text-slate-700">{data.counterStatement??t('noReply')}</p></section>
     <section className={card}><h2 className="text-xl font-semibold">{t('evidence')}</h2><div className="mt-4 flex flex-wrap gap-3">{data.evidenceDocIds.map((path,index)=><Button key={path} data-dispute-evidence variant="secondary" disabled={!detail.fresh} onClick={()=>{if(!detail.isVerifiedCurrent()||!data.evidenceDocIds.includes(path))return;resolution.back();setDocument({path,id:data.id,generation:detail.readGeneration,valid:detail.isVerifiedCurrent});}}>{t('image')} {index+1}</Button>)}</div>{!data.evidenceDocIds.length&&<p className="mt-4 text-slate-600">{t('noEvidence')}</p>}</section>
     <section className={card}>
      {resolution.storageError&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-900">{t('storageError')}</p>}
      {resolution.warning503&&<p role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-amber-900">{t('warning')}</p>}
      {resolution.outcome&&<div data-resolution-unknown role="status" className="mb-6 space-y-3 rounded-xl bg-amber-50 p-4 text-amber-900"><p>{resolution.outcome.pending?t('sending'):resolution.outcome.checking?t('checking'):resolution.outcome.rejected?t('rejected'):t('unknown')}</p><Button data-resolution-reconcile disabled={resolution.outcome.pending||resolution.outcome.checking} onClick={()=>void resolution.reconcile()}>{t('reconcile')}</Button></div>}
      {data.status==='RESOLVED'?<div data-resolution-recorded><h2 className="text-xl font-semibold">{t('recorded')}</h2><p className="mt-4 whitespace-pre-wrap">{data.resolutionNote??'—'}</p><p className="mt-3 text-sm text-slate-600">{date(data.resolvedAt)}</p><dl className="mt-4"><div>{t('refund')}: {boolean(data.refundServiceFee)}</div><div>{t('penalty')}: {boolean(data.penalizeMaster)}</div></dl><p className="mt-4 text-sm text-slate-600">{t('recordedHelp')}</p></div>:<>
       {resolution.pilotReadOnly&&<p data-resolution-readonly role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-amber-900">{t('modeReadOnly')}</p>}<label htmlFor="resolution-note" className="text-xl font-semibold">{t('note')}</label><textarea id="resolution-note" name="resolutionNote" value={resolution.note} maxLength={2000} disabled={!!resolution.outcome||resolution.pilotReadOnly} aria-describedby="resolution-note-help" onChange={event=>resolution.changeNote(event.target.value)} className="mt-3 min-h-32 w-full rounded-xl border border-slate-300 p-3 focus-visible:outline-2 focus-visible:outline-[#123b52] disabled:bg-slate-50"/><p id="resolution-note-help" className="text-sm text-slate-600">{t('noteHelp')}</p>
       <label className="mt-4 flex gap-3 text-slate-500"><input name="refundServiceFee" type="checkbox" checked={false} disabled/>{t('refund')}</label><label className="mt-3 flex gap-3 text-slate-500"><input name="penalizeMaster" type="checkbox" checked={false} disabled/>{t('penalty')}</label><p className="my-4 rounded-xl bg-[#f4f3ef] p-4 text-sm text-slate-600">{t('restricted')}</p>
       {resolution.stage?<div className="mt-6 space-y-4 rounded-xl border border-[#123b52] bg-[#eef4f6] p-4"><h3 className="font-semibold">{t('confirm')}</h3><p>{t('confirmHelp')}</p><p className="whitespace-pre-wrap">{resolution.note}</p><div className="flex flex-wrap gap-3"><Button data-resolution-submit disabled={!resolution.canSubmit} onClick={()=>void resolution.submit()}>{t('confirm')}</Button><Button data-resolution-back variant="secondary" onClick={resolution.back}>{t('back')}</Button></div></div>:<Button data-resolution-prepare disabled={!resolution.canPrepare} onClick={resolution.prepare}>{t('prepare')}</Button>}
      </>}
     </section>
    </div>
    <aside className={`${card} self-start`}><h2 className="text-xl font-semibold">{t('context')}</h2><div className="my-4">{readState(order)}{!related&&!order.loading&&<p>{t('unknownOrder')}</p>}</div><Button variant="secondary" disabled={order.loading} onClick={()=>{resolution.back();void order.retry();}}>{t('retry')}</Button>
     {related&&<><p className="mt-4 break-all text-sm">{related.id}</p><p className="mt-2">{related.category}</p><p className="mt-3 text-slate-600">{related.address}</p><p className="text-slate-600">{related.district}</p><p className="mt-4">{t('client')}: {related.client.name??'—'}</p><p>{t('master')}: {related.master?.name??'—'}</p>
      <dl className="my-4 space-y-2 rounded-xl bg-[#f4f3ef] p-4">{related.type==='urgent'&&related.commercialMode==='DIRECT_PAYMENT'?<><dt>{t('total')}</dt><dd className="font-semibold">{related.quoteVersion>0?amount(related.quoteTotal):<span data-dispute-quote-unknown>{t('unknownPrice')}</span>}</dd></>:related.type==='urgent'?<>{([[t('callout'),related.calloutPrice],[t('fee'),related.serviceFee],[t('work'),related.workPrice]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd className="font-semibold">{amount(value)}</dd></div>)}</>:<><dt>{t('budget')}</dt><dd className="font-semibold">{amount(related.budget)}</dd><dt>{t('work')}</dt><dd>{amount(related.workPrice)}</dd></>}</dl>
      {data.commercialMode==='FREE_PILOT'&&<p data-dispute-pilot-amounts className="mb-4 text-sm text-slate-600">{t('pilotAmounts')}</p>}
      {related.timeline.length>0&&<><h3 className="font-semibold">{t('timeline')}</h3>{related.timeline.map((event,index)=><p className="mt-2 text-sm text-slate-600" key={index}>{date(event.at)} · {event.event}</p>)}</>}
     </>}
     {orderHref&&<Link data-dispute-orders-link href={orderHref} className="mt-4 inline-flex min-h-12 items-center font-medium underline underline-offset-4 focus-visible:outline-2">{t('orders')}</Link>}
    </aside>
   </div>}
  </>}
  {document&&documentCurrent()&&<VerificationDocument path={`/disputes/${encodeURIComponent(document.id)}/evidence/${encodeURIComponent(document.path)}`} title={t('evidence')} scope={`${document.id}:${document.path}:${document.generation}`} isCurrent={documentCurrent} onClose={()=>setDocument(null)} allowedMimeTypes={images} viewNote={t('viewNote')}/>}
 </div>;
}
