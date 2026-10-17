'use client';
import {formatServiceDate} from '@masterqala/ui';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {Button,Dialog} from '@masterqala/ui';
import type {OrderDetail} from '@/lib/orderTypes';
import {desktopCopy} from '../desktop-order/copy';
import {urgentCopy} from './copy';
import {pilotActions} from './pilot-state';
type Props={order:OrderDetail;language:'ru'|'kk'|'en';categoryLabel:string;busy:boolean;fresh:boolean;online:boolean;error:string;onAction:(action:string,body?:object)=>Promise<boolean>;onRefresh:()=>void;map?:ReactNode};
export function PilotOrderView({order,language,categoryLabel,busy,fresh,online,error,onAction,onRefresh,map}:Props){
 const c=urgentCopy[language],d=desktopCopy[language],actions=pilotActions(order),context=[order.id,order.status,order.updatedAt].join(':');
 const [confirmation,setConfirmation]=useState<{action:'cancel'|'reject-price';context:string}|null>(null),[sending,setSending]=useState(false),[failed,setFailed]=useState(false);
 const flight=useRef(false),active=useRef(false),latest=useRef({context,actions,disabled:false});
 const disabled=busy||sending||!fresh||!online;
 latest.current={context,actions,disabled};
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{setConfirmation(null);setFailed(false);},[context]);
 async function send(action:string,body?:object){if(!active.current||flight.current||latest.current.disabled||latest.current.context!==context||!latest.current.actions.includes(action))return;flight.current=true;setSending(true);setFailed(false);try{const ok=await onAction(action,body);if(active.current){if(ok)setConfirmation(null);else setFailed(true);}}catch{if(active.current)setFailed(true);}finally{flight.current=false;if(active.current)setSending(false);}}
 const searching=['CREATED','SEARCHING'].includes(order.status),tracking=['ACCEPTED','MASTER_ON_WAY','INSPECTION'].includes(order.status),quote=order.status==='AWAITING_PRICE_CONFIRM',working=order.status==='IN_PROGRESS',done=order.status==='DONE',closed=order.status==='CLOSED',cancelled=order.status.startsWith('CANCELLED_');
 const mapStage=searching||tracking||quote||working;
 const title=c.statuses[order.status as keyof typeof c.statuses]??c.unknown;
 const explanation=searching?c.search:order.status==='NO_MASTERS'?c.noMasters:order.status==='INSPECTION'?c.inspection:working?c.working:done?c.done:closed?c.closed:cancelled?c.cancelled:order.status==='DISPUTE'?c.dispute:'';
 const price=typeof order.workPrice==='number'&&Number.isFinite(order.workPrice)&&order.workPrice>=0?new Intl.NumberFormat(language==='kk'?'kk-KZ':language==='ru'?'ru-KZ':'en-GB').format(order.workPrice)+' ₸':'—';
 const created=Number.isFinite(Date.parse(order.createdAt))?formatServiceDate(new Date(order.createdAt),language,{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
 const confirmVisible=!!confirmation&&confirmation.context===context&&actions.includes(confirmation.action);
 return <div className={mapStage?'urgent-map-page':'urgent-result-page'}>{mapStage&&<section className="urgent-map-background" aria-label={c.map}>{map??<p>{c.mapMissing}</p>}</section>}<div className="planned-heading"><Link href="/orders">← {c.back}</Link><h1 data-urgent-status={order.status}>{title}</h1><p>{categoryLabel}</p></div><div className="planned-columns urgent-columns"><div className="planned-stack"><section className="planned-card urgent-workflow">
  <h2>{title}</h2>{explanation&&<p>{explanation}</p>}
  {order.master&&!searching&&<div className="urgent-master"><span className="urgent-avatar" aria-hidden="true">{order.master.name?.slice(0,2).toUpperCase()||'—'}</span><div><small>{c.master}</small><strong>{order.master.name||c.noName}</strong></div>{order.master.phone&&<a className="urgent-call" href={'tel:'+order.master.phone}>{c.call}</a>}</div>}
  {(quote||working||done||closed)&&<div className="urgent-price"><span>{c.work}</span><strong>{price}</strong></div>}
  {order.workComment&&(quote||working||done||closed)&&<div className="urgent-comment"><h3>{c.comment}</h3><p>{order.workComment}</p></div>}
  {!online?<p role="status">{c.offline}</p>:!fresh?<p role="status">{c.stale}</p>:null}
  {(error||failed)&&<p role="alert">{c.error}</p>}
  {(!fresh||error||failed)&&<Button variant="secondary" disabled={busy||sending||!online} onClick={onRefresh}>{c.refresh}</Button>}
  <div className="urgent-actions">
   {actions.includes('confirm-price')&&<Button data-urgent-action="confirm-price" disabled={disabled} loading={sending} loadingLabel={c.busy} onClick={()=>void send('confirm-price')}>{c.approve} · {price}</Button>}
   {actions.includes('reject-price')&&<Button data-urgent-action="reject-price" variant="secondary" disabled={disabled} onClick={()=>setConfirmation({action:'reject-price',context})}>{c.reject}</Button>}
   {actions.includes('confirm-completion')&&<Button data-urgent-action="confirm-completion" disabled={disabled} loading={sending} loadingLabel={c.busy} onClick={()=>void send('confirm-completion')}>{c.accept}</Button>}
   {actions.includes('retry-search')&&<Button data-urgent-action="retry-search" disabled={disabled} loading={sending} loadingLabel={c.busy} onClick={()=>void send('retry-search')}>{c.retry}</Button>}
   {actions.includes('cancel')&&<Button data-urgent-action="cancel" variant="secondary" disabled={disabled} onClick={()=>setConfirmation({action:'cancel',context})}>{c.cancel}</Button>}
   {order.status==='NO_MASTERS'&&<Link className="urgent-secondary-link" href="/planned/new">{c.planned}</Link>}
   {(done||closed)&&<Link className="urgent-secondary-link" href={'/order/'+encodeURIComponent(order.id)+'/dispute'}>{c.problem}</Link>}
   {(closed||cancelled)&&<Link className="urgent-secondary-link" href="/">{c.newOrder}</Link>}
  </div>
  {closed&&<div className="urgent-review"><h3>{order.review?c.thanks:c.rating}</h3>{order.review?<p>{order.review.rating} / 5{order.review.comment?' · '+order.review.comment:''}</p>:<div>{[1,2,3,4,5].map(rating=><button type="button" key={rating} aria-label={c.ratingLabel+' '+rating+' / 5'} disabled={disabled} onClick={()=>void send('review',{rating})}>☆ {rating}</button>)}</div>}</div>}
 </section></div>
 <aside className="planned-card planned-summary planned-context"><h2>{c.summary}</h2><dl><div><dt>{c.task}</dt><dd>{order.description}</dd></div><div><dt>{c.address}</dt><dd>{order.address}</dd></div>{[order.entrance,order.floor,order.apartment].some(Boolean)&&<div><dt>{c.details}</dt><dd>{[order.entrance||'—',order.floor||'—',order.apartment||'—'].join(' / ')}</dd></div>}<div><dt>{c.created}</dt><dd>{created}</dd></div><div><dt>ID</dt><dd className="urgent-id">{order.id}</dd></div></dl><div className="planned-pilot"><strong>{d.pilot}</strong><p>{d.pilotNote}</p></div><Link className="urgent-secondary-link" href="/support">{c.help}</Link></aside></div>
 <Dialog open={confirmVisible} title={confirmation?.action==='reject-price'?c.reject:c.confirmCancel} busy={busy||sending} onClose={()=>setConfirmation(null)}><h2 className="text-xl font-semibold">{confirmation?.action==='reject-price'?c.reject:c.confirmCancel}</h2><p>{confirmation?.action==='reject-price'?c.rejectNote:c.cancelNote}</p>{(error||failed)&&<p role="alert">{c.error}</p>}<Button data-urgent-confirm disabled={disabled||!confirmVisible} loading={sending} loadingLabel={c.busy} onClick={()=>{if(confirmation)void send(confirmation.action);}}>{c.confirm}</Button><Button variant="secondary" disabled={busy||sending} onClick={()=>setConfirmation(null)}>{c.keep}</Button></Dialog></div>;
}
