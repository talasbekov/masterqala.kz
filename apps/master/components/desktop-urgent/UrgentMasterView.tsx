'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Button,Dialog,TextField,useLocale} from '@masterqala/ui';
import type {ActiveOrder} from '@/lib/activeOrder';
import {useMasterPresence} from '@/lib/masterPresence';
import {masterCategoryName} from '@/lib/category-name';
import MapView from '../MapView';
import {completionConfirmation} from './completionConfirmation';
import {urgentCopy,urgentStatus} from './copy';
import type {UrgentAction} from './useUrgentMasterOrder';
import {clearUrgentQuoteDraft,emptyUrgentQuoteDraft,readUrgentQuoteDraft,saveUrgentQuoteDraft} from './quoteDraft';
import './urgent.css';

export function UrgentMasterView({ownerId,order,busy,fresh,online,error,onRefresh,onAction}:{ownerId:string;order:ActiveOrder;busy:boolean;fresh:boolean;online:boolean;error:string;onRefresh:()=>Promise<void>;onAction:(action:UrgentAction,body?:{amount:number;comment?:string})=>Promise<boolean>}) {
 const {language,formatMoney}=useLocale(),c=urgentCopy[language],status=urgentStatus(order.status,c),completion=completionConfirmation(language,order);
 const {myPosition}=useMasterPresence();
 // Owner/id keyed by the container: polls and locale changes never replace the draft.
 const [price,setPrice]=useState(''),[comment,setComment]=useState(''),[draftAvailable,setDraftAvailable]=useState(true),[draftRestored,setDraftRestored]=useState(false),[confirm,setConfirm]=useState<'complete'|'cancel'|null>(null);
 useEffect(()=>{
  const saved=order.status==='INSPECTION'?readUrgentQuoteDraft(ownerId,order.id):{draft:emptyUrgentQuoteDraft(),available:true};
  setPrice(saved.draft.price);setComment(saved.draft.comment);setDraftAvailable(saved.available);setDraftRestored(true);
  // The owner/order keyed container creates a new view for each identity; refreshes must not reload the draft.
 },[ownerId,order.id]);
 useEffect(()=>{
  if(!draftRestored)return;
  if(order.status==='INSPECTION')setDraftAvailable(saveUrgentQuoteDraft(ownerId,order.id,{price,comment}));
  else {clearUrgentQuoteDraft(ownerId,order.id);setPrice('');setComment('');}
 },[ownerId,order.id,order.status,price,comment,draftRestored]);
 const disabled=busy||!fresh||!online||!draftRestored,amount=Number(price),valid=price.trim()!==''&&Number.isInteger(amount)&&amount>=1&&amount<=2147483647;
 const pilot=order.commercialMode==='FREE_PILOT'||!order.commercialMode&&order.freePilot;
 const knownPrice=typeof order.workPrice==='number'&&Number.isFinite(order.workPrice)&&order.workPrice>0;
 const hasLocation=typeof order.lat==='number'&&Number.isFinite(order.lat)&&Math.abs(order.lat)<=90&&typeof order.lng==='number'&&Number.isFinite(order.lng)&&Math.abs(order.lng)<=180;
 const canCancel=['ACCEPTED','MASTER_ON_WAY'].includes(order.status);
 const confirming=confirm==='complete'&&order.status==='IN_PROGRESS'||confirm==='cancel'&&canCancel;
 async function confirmAction(){if(disabled||!confirming||!confirm)return;if(await onAction(confirm))setConfirm(null);}
 return <main className="mq-urgent" data-urgent-order={order.id}>
  <nav><Link href="/">{c.back}</Link><span>{c.urgent} · {order.id.slice(0,8)}</span></nav>
  <header className="mq-urgent-heading"><p className="mq-urgent-eyebrow">{pilot?c.pilot:c.urgent}</p><h1>{status.title}</h1><p>{status.note}</p></header>
  <div className="mq-urgent-columns"><div className="mq-urgent-main">
   <section className="mq-urgent-card" aria-labelledby="urgent-task-heading"><h2 id="urgent-task-heading">{order.category?masterCategoryName(order.category,language):c.task}</h2><p className="mq-urgent-description">{order.description}</p><p>{order.address}</p>{order.district&&<p className="mq-urgent-muted">{order.district}</p>}
    {(order.entrance||order.floor||order.apartment||order.addressComment)&&<div className="mq-urgent-address"><h3>{c.details}</h3><dl>{(['entrance','floor','apartment'] as const).map(key=>order[key]?<div key={key}><dt>{c[key]}</dt><dd>{order[key]}</dd></div>:null)}</dl>{order.addressComment&&<p>{order.addressComment}</p>}</div>}
   </section>
   <section className="mq-urgent-card" aria-labelledby="urgent-price-heading"><h2 id="urgent-price-heading">{c.quote}</h2>
    {order.status==='INSPECTION'?<form onSubmit={event=>{event.preventDefault();if(valid&&!disabled)void onAction('propose-price',{amount,comment:comment.trim()||undefined});}}>
     {!draftAvailable&&<p role="status" className="mq-urgent-notice">{c.draftUnsaved}</p>}
     <TextField label={c.amount} type="number" inputMode="numeric" min={1} max={2147483647} step={1} value={price} onChange={event=>setPrice(event.target.value)} disabled={busy} fullWidth aria-describedby={price&&!valid?'urgent-price-error':undefined}/>
     {price&&!valid&&<p id="urgent-price-error" role="alert" className="mq-urgent-error">{c.validation}</p>}
     <label className="mq-urgent-label" htmlFor="urgent-comment">{c.comment}<textarea id="urgent-comment" maxLength={1000} rows={4} value={comment} onChange={event=>setComment(event.target.value)} disabled={busy}/></label>
     <Button data-urgent-action="propose-price" type="submit" disabled={disabled||!valid} loading={busy} loadingLabel={c.busy}>{c.send}</Button>
    </form>:<>{knownPrice?<dl className="mq-urgent-price"><dt>{order.status==='AWAITING_PRICE_CONFIRM'?c.pendingPrice:c.agreedPrice}</dt><dd>{formatMoney(order.workPrice!)}</dd></dl>:<p className="mq-urgent-muted">{c.quoteMissing}</p>}{order.workComment&&<p className="mq-urgent-description">{order.workComment}</p>}</>}
   </section>
   <section className="mq-urgent-card"><h2>{status.title}</h2><p>{status.note}</p>{pilot&&<div className="mq-urgent-notice"><h3>{c.pilot}</h3><p>{c.pilotNote}</p></div>}{order.commercialMode==='PAID_MOCK'&&<p className="mq-urgent-notice">{c.mock}</p>}
    {!online&&<p role="status" className="mq-urgent-notice">{c.offline}</p>}{online&&!fresh&&<p role="status">{c.stale}</p>}{error&&<p role="alert" className="mq-urgent-error">{error==='action'?c.actionError:c.readError}</p>}
    <div className="mq-urgent-actions">
     {order.status==='ACCEPTED'&&<Button data-urgent-action="on-way" disabled={disabled} loading={busy} loadingLabel={c.busy} onClick={()=>void onAction('on-way')}>{c.onWay}</Button>}
     {order.status==='MASTER_ON_WAY'&&<Button data-urgent-action="on-site" disabled={disabled} loading={busy} loadingLabel={c.busy} onClick={()=>void onAction('on-site')}>{c.onSite}</Button>}
     {order.status==='IN_PROGRESS'&&<Button data-urgent-action="complete" disabled={disabled} onClick={()=>setConfirm('complete')}>{completion.confirmLabel}</Button>}
     <Button variant="secondary" disabled={busy||!online} onClick={()=>void onRefresh()}>{c.refresh}</Button>
     {canCancel&&<Button variant="white" disabled={disabled} onClick={()=>setConfirm('cancel')}>{c.cancel}</Button>}
    </div>
   </section>
   <section className="mq-urgent-card" aria-labelledby="urgent-map-heading"><h2 id="urgent-map-heading">{c.map}</h2>{hasLocation?<MapView key={`${order.id}:${order.lat}:${order.lng}`} mode="tracking" center={{lat:order.lat!,lng:order.lng!}} masterPosition={myPosition} height={320}/>:<p className="mq-urgent-muted">{c.noMap}</p>}</section>
  </div><aside className="mq-urgent-aside">
   <section className="mq-urgent-card"><h2>{c.contact}</h2>{order.client?.name&&<p>{order.client.name}</p>}{order.client?.phone?<a className="mq-urgent-link-button" href={`tel:${order.client.phone}`}>{c.call}<span>{order.client.phone}</span></a>:<p className="mq-urgent-muted">{c.noContact}</p>}<Link className="mq-urgent-link-button" href={`/order/${encodeURIComponent(order.id)}/dispute`}>{c.help}</Link><Link className="mq-urgent-link-button" href="/history">{c.history}</Link></section>
  </aside></div>
  <Dialog open={confirming} title={confirm==='complete'?completion.title:c.cancelTitle} busy={busy} onClose={()=>setConfirm(null)}><div className="mq-urgent-confirm"><h2>{confirm==='complete'?completion.title:c.cancelTitle}</h2><p>{confirm==='complete'?completion.body:c.cancelNote}</p>{error&&<p role="alert">{c.actionError}</p>}<Button disabled={disabled} loading={busy} loadingLabel={c.busy} variant={confirm==='cancel'?'danger':'primary'} onClick={()=>void confirmAction()}>{confirm==='complete'?completion.confirmLabel:c.confirmCancel}</Button><Button disabled={busy} variant="secondary" onClick={()=>setConfirm(null)}>{confirm==='complete'?completion.cancelLabel:c.keep}</Button></div></Dialog>
 </main>;
}
