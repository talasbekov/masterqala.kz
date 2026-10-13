'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ownsPendingCreate,currentOrderSubmission,canRecoverCreate,sendCurrentOrder,createDraftSession,DRAFT_CLEARED_EVENT,DRAFT_CREATED_EVENT,beginPendingCreate,readPendingCreate,resolvePendingCreate,type PendingCreate,emptyNewOrderDraft,type NewOrderDraft} from '../lib/new-order-draft';
export function useNewOrderDraft(ownerId:string) {
 const request=useRef<PendingCreate|null>(null);
 const [outcome,setOutcome]=useState<{ownerId:string;pending:PendingCreate|null;completedOrderId:string|null}|null>(null);
 const session=useRef<ReturnType<typeof createDraftSession>|null>(null);
 const [state,setState]=useState<{ownerId:string;draft:NewOrderDraft}|null>(null);
 useEffect(()=>{
   const current=createDraftSession(ownerId);
   session.current=current;
   request.current=readPendingCreate(ownerId);
   if(request.current)current.freeze();
   setOutcome({ownerId,pending:request.current,completedOrderId:null});
   const update=()=>setState({ownerId,draft:current.getSnapshot()});
   update();const unsubscribe=current.subscribe(update);
   const invalidate=()=>{current.dispose();request.current=null;setOutcome({ownerId,pending:null,completedOrderId:null});};
   const created=(event:Event)=>{
     const detail=(event as CustomEvent).detail;
     if(detail?.ownerId!==ownerId||detail?.requestId!==request.current?.requestId)return;
     current.dispose();request.current=null;
     setState({ownerId,draft:emptyNewOrderDraft()});
     setOutcome({ownerId,pending:null,completedOrderId:detail.orderId});
   };
   window.addEventListener(DRAFT_CLEARED_EVENT,invalidate);
   window.addEventListener(DRAFT_CREATED_EVENT,created);
   return()=>{window.removeEventListener(DRAFT_CREATED_EVENT,created);window.removeEventListener(DRAFT_CLEARED_EVENT,invalidate);unsubscribe();current.dispose();if(session.current===current)session.current=null;};
 },[ownerId]);
 const set=useCallback(<K extends keyof NewOrderDraft>(key:K,value:NewOrderDraft[K]|((previous:NewOrderDraft[K])=>NewOrderDraft[K]))=>session.current?.set(key,value),[]);
 const applyInitialLocation=useCallback((geo:NewOrderDraft['geo'])=>session.current?.applyInitialLocation(geo),[]);
 const requestLocation=useCallback(()=>session.current?.requestLocation()??(()=>{}),[]);
 const complete=useCallback(()=>session.current?.complete()??false,[]);
 const beginCreate=useCallback((keyed=false)=>{
   if(!session.current?.isActive()||request.current)return null;
   const submitted=keyed?currentOrderSubmission(session.current.getSnapshot()):undefined;
   if(keyed&&!submitted)return null;
   const pending=beginPendingCreate(ownerId,undefined,submitted??undefined);if(!pending)return null;
   session.current.freeze();
   request.current=pending;setOutcome({ownerId,pending,completedOrderId:null});return pending;
 },[ownerId]);
 const finishCreate=useCallback((pending:PendingCreate,orderId:string)=>{
   if(pending.ownerId!==ownerId)return false;
   const wasActive=!!session.current?.isActive()&&request.current?.requestId===pending.requestId;
   const resolved=resolvePendingCreate(pending,orderId);
   if(!resolved&&!pending.persistent&&wasActive)return session.current?.complete()??false;
   return resolved&&wasActive;
 },[ownerId]);
 return {draft:state?.ownerId===ownerId?state.draft:emptyNewOrderDraft(),ready:state?.ownerId===ownerId,set,applyInitialLocation,requestLocation,complete,beginCreate,finishCreate,pending:outcome?.ownerId===ownerId?outcome.pending:null,completedOrderId:outcome?.ownerId===ownerId?outcome.completedOrderId:null};
}

/** No mount effect submits: recovery is an explicit same-key action. */
export function useCurrentOrderCreation({beginCreate,finishCreate,pending,api,onConfirmed,invalidMessage='Check required fields before submitting'}:{
 beginCreate:(keyed?:boolean)=>PendingCreate|null;
 finishCreate:(request:PendingCreate,id:string)=>boolean;
 pending:PendingCreate|null;
 api:Parameters<typeof sendCurrentOrder>[1];
 onConfirmed:(id:string)=>void;
 invalidMessage?:string;
}) {
 const active=useRef(false),inflight=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [recovering,setRecovering]=useState(false);
 const [online,setOnline]=useState(true);
 useEffect(()=>{
  active.current=true;
  const update=()=>setOnline(navigator.onLine);update();
  window.addEventListener('online',update);window.addEventListener('offline',update);
  return()=>{active.current=false;window.removeEventListener('online',update);window.removeEventListener('offline',update);};
 },[]);
 async function run(recovery:boolean) {
  if(!active.current||inflight.current||!navigator.onLine||(!recovery&&pending))return;
  const request=recovery?pending:beginCreate(true);
  if(!request&&!recovery){setError(invalidMessage);return;}
  if(!request||!canRecoverCreate(request)||!ownsPendingCreate(request))return;
  inflight.current=true;setBusy(true);setRecovering(recovery);setError('');
  try {
   const order=await sendCurrentOrder(request,api);
   // Exact late results may settle a remounted matching draft, but never navigate an old form.
   const owns=finishCreate(request,order.id);
   if(active.current&&owns)onConfirmed(order.id);
  }catch(e){if(active.current)setError(e instanceof Error?e.message:String(e));}
  finally{inflight.current=false;if(active.current)setBusy(false);}
 }
 return {busy,error,online,recovering,canRecover:canRecoverCreate(pending),submit:()=>run(false),recover:()=>run(true)};
}
