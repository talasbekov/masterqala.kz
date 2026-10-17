'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {api as defaultApi,ApiError} from '@/lib/api';
import {getSocket as defaultGetSocket} from '@/lib/socket';
import type {ActiveOrder} from '@/lib/activeOrder';

export type UrgentAction='on-way'|'on-site'|'propose-price'|'complete'|'cancel';
type Socket={on:(event:string,handler:(payload?:{orderId:string})=>void)=>unknown;off:(event:string,handler:(payload?:{orderId:string})=>void)=>unknown};
type Transport=(path:string,options?:RequestInit)=>Promise<unknown>;
const permitted:Record<UrgentAction,string[]>={'on-way':['ACCEPTED'],'on-site':['MASTER_ON_WAY'],'propose-price':['INSPECTION'],complete:['IN_PROGRESS'],cancel:['ACCEPTED','MASTER_ON_WAY']};
export function canUrgentAction(order:ActiveOrder|null,action:UrgentAction){return !!order&&order.lifecycleVersion<2&&permitted[action].includes(order.status);}
function parseOrder(value:unknown,id:string,ownerId:string):ActiveOrder {
 const order=value as ActiveOrder&{masterId?:string};
 if(!order||order.id!==id||order.masterId!==ownerId)throw new ApiError(403,'Order unavailable');
 if(typeof order.status!=='string'||!Number.isInteger(order.lifecycleVersion)||order.lifecycleVersion<1||typeof order.address!=='string'||typeof order.description!=='string')throw new Error('Invalid order response');
 return order;
}

/** A committed owner/id lifetime owns reads, callbacks and the synchronous mutation lock. */
export function useUrgentMasterOrder({ownerId,id,api=defaultApi,getSocket=defaultGetSocket,onChanged}:{ownerId:string|null;id:string;api?:Transport;getSocket?:()=>Socket;onChanged?:()=>void}) {
 const lifetime=useMemo(()=>({ownerId,id}),[ownerId,id]);
 const current=useRef(lifetime),mounted=useRef(false),generation=useRef(0),locked=useRef(false),verified=useRef<{order:ActiveOrder;at:number}|null>(null);
 const changed=useRef(onChanged);changed.current=onChanged;
 const blank=()=>({lifetime,order:null as ActiveOrder|null,loading:!!ownerId,busy:false,fresh:false,online:true,error:'',unavailable:false});
 const [state,setState]=useState(blank);
 const valid=useCallback(()=>mounted.current&&current.current===lifetime,[lifetime]);
 useLayoutEffect(()=>{current.current=lifetime;mounted.current=true;generation.current++;locked.current=false;verified.current=null;setState(blank());return()=>{mounted.current=false;verified.current=null;generation.current++;};},[lifetime]);
 const read=useCallback(async()=>{
  if(!ownerId||!valid())return null;
  verified.current=null;const request=++generation.current;
  setState(previous=>({...previous,fresh:false,online:navigator.onLine}));
  if(!navigator.onLine){setState(previous=>({...previous,loading:false}));return null;}
  try {
   const order=parseOrder(await api(`/orders/${encodeURIComponent(id)}`),id,ownerId);
   if(!valid()||generation.current!==request)return null;
   verified.current={order,at:Date.now()};setState(previous=>({...previous,order,loading:false,fresh:true,error:'',unavailable:false}));return order;
  }catch(error){
   if(valid()&&generation.current===request){const unavailable=error instanceof ApiError&&[401,403,404].includes(error.status);setState(previous=>({...previous,order:unavailable?null:previous.order,loading:false,fresh:false,error:'read',unavailable}));}
   return null;
  }
 },[ownerId,id,api,valid]);
 const refresh=useCallback(async()=>{if(!valid()||locked.current)return;await read();},[valid,read]);
 useEffect(()=>{
  if(!ownerId)return;
  void refresh();const socket=getSocket();
  const changed=(payload?:{orderId:string})=>{if(valid()&&payload?.orderId===id)void refresh();};
  const reconnect=()=>{if(valid())void refresh();};
  const invalidate=()=>{if(!valid())return;verified.current=null;generation.current++;setState(previous=>({...previous,fresh:false,online:navigator.onLine}));};
  const network=()=>{invalidate();if(navigator.onLine)void refresh();};
  const foreground=()=>{if(document.visibilityState==='visible')void refresh();};
  socket.on('order:status',changed);socket.on('connect',reconnect);socket.on('disconnect',invalidate);
  window.addEventListener('online',network);window.addEventListener('offline',network);document.addEventListener('visibilitychange',foreground);
  const timer=window.setInterval(()=>{if(valid()&&document.visibilityState==='visible')void refresh();},20000);
  return()=>{window.clearInterval(timer);socket.off('order:status',changed);socket.off('connect',reconnect);socket.off('disconnect',invalidate);window.removeEventListener('online',network);window.removeEventListener('offline',network);document.removeEventListener('visibilitychange',foreground);};
 },[ownerId,id,getSocket,refresh,valid]);
 const mutate=useCallback(async(action:UrgentAction,body?:{amount:number;comment?:string})=>{
  const snapshot=verified.current;
  if(!valid()||locked.current||!navigator.onLine||!snapshot||Date.now()-snapshot.at>30000||!canUrgentAction(snapshot.order,action))return false;
  if(action==='propose-price'&&(!body||!Number.isInteger(body.amount)||body.amount<1||body.amount>2147483647||(body.comment?.length??0)>1000))return false;
  locked.current=true;verified.current=null;generation.current++;setState(previous=>({...previous,busy:true,fresh:false,error:''}));
  let failure=false;
  try{await api(`/orders/${encodeURIComponent(id)}/${action}`,{method:'POST',...(body?{body:JSON.stringify(body)}:{})});}catch{failure=true;}
  if(!valid())return false;
  // Every outcome is reconciled before another write; never automatically replay a lost POST.
  const reconciled=await read();
  if(!valid())return false;
  const advanced=!!reconciled&&reconciled.status!==snapshot.order.status;
  const successful=!failure||advanced;
  locked.current=false;setState(previous=>({...previous,busy:false,error:failure&&!advanced?'action':previous.error}));
  if(successful)changed.current?.();
  return successful;
 },[id,api,read,valid]);
 return {...(state.lifetime===lifetime?state:blank()),refresh,mutate};
}
