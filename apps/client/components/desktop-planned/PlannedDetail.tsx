'use client';
import {formatServiceDate} from '@masterqala/ui';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useLocale} from '@masterqala/ui';
import {useTranslation} from 'react-i18next';
import {useAuth} from '@/lib/auth';
import {api} from '@/lib/api';
import {getSocket} from '@/lib/socket';
import type {PlannedOrderDetail} from '@/lib/plannedOrderTypes';
import PwaitView from '../planned-order-views/PwaitView';
import PactiveView from '../planned-order-views/PactiveView';
import PlannedDoneView from '../planned-order-views/PlannedDoneView';
import PlannedClosedView from '../planned-order-views/PlannedClosedView';
import {plannedCopy} from './copy';
import {desktopCopy} from '../desktop-order/copy';
export default function PlannedDetail(){const {id}=useParams<{id:string}>(),{user}=useAuth();return user&&id?<OwnedDetail key={user.id+':'+id} id={id}/>:null;}
function OwnedDetail({id}:{id:string}){
 const {language}=useLocale(),c=plannedCopy[language],d=desktopCopy[language],{t}=useTranslation();
 const [order,setOrder]=useState<PlannedOrderDetail|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(true);
 const active=useRef(false),request=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{request.current?.abort();const controller=new AbortController();request.current=controller;setError(false);try{const result=await api('/planned-orders/'+encodeURIComponent(id),{signal:controller.signal});if(active.current&&!controller.signal.aborted)setOrder(result);}catch{if(active.current&&!controller.signal.aborted)setError(true);}finally{if(active.current&&!controller.signal.aborted)setLoading(false);}},[id]);
 useEffect(()=>{active.current=true;void load();const socket=getSocket();const update=(event:{plannedOrderId:string})=>{if(event.plannedOrderId===id)void load();};socket.on('bid:new',update);socket.on('planned:status',update);return()=>{active.current=false;request.current?.abort();socket.off('bid:new',update);socket.off('planned:status',update);};},[id,load]);
 if(loading)return <p>{d.loading}</p>;
 if(error||!order)return <section className="planned-card"><p role="alert">{c.network}</p><button onClick={()=>void load()}>{d.retry}</button></section>;
 const live=['MASTER_SELECTED','CONFIRMED','IN_PROGRESS'].includes(order.status),closed=['CLOSED','CANCELLED','EXPIRED'].includes(order.status);
 const date=formatServiceDate(new Date(order.slotStart),language,{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
 return <><div className="planned-heading"><Link href="/orders">← {c.back}</Link><h1>{closed?c.closed:order.status==='PUBLISHED'?c.offers:c.active}</h1><p>{t(`plannedStatus.${order.status}`,{defaultValue:order.status})}</p></div><div className="planned-columns"><section className="planned-card planned-detail-content">{order.status==='PUBLISHED'?<PwaitView order={order} orderId={id} onChanged={load}/>:live?<PactiveView order={order} orderId={id} onChanged={load}/>:order.status==='DONE'?<PlannedDoneView order={order} orderId={id} onChanged={load}/>:<PlannedClosedView order={order} onChanged={load}/>}</section><aside className="planned-card planned-summary planned-context"><h2>{c.details}</h2><dl><div><dt>{d.category}</dt><dd>{t(`newOrder.category_${order.category?.slug}`,{defaultValue:order.category?.name??'—'})}</dd></div><div><dt>{d.description}</dt><dd>{order.description}</dd></div><div><dt>{d.address}</dt><dd>{order.address} · {order.district}</dd></div><div><dt>{c.schedule} · {c.time}</dt><dd>{date}</dd></div>{order.budget!==null&&<div><dt>{c.budget}</dt><dd>{order.budget.toLocaleString(language)} ₸</dd></div>}</dl>{order.commercialMode==='FREE_PILOT'&&<div className="planned-pilot"><strong>{d.pilot}</strong><p>{d.pilotNote}</p></div>}</aside></div></>;
}
