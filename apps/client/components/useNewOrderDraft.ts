'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createDraftSession,DRAFT_CLEARED_EVENT,DRAFT_CREATED_EVENT,beginPendingCreate,readPendingCreate,resolvePendingCreate,type PendingCreate,emptyNewOrderDraft,type NewOrderDraft} from '../lib/new-order-draft';
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
 const beginCreate=useCallback(()=>{
   if(!session.current?.isActive()||request.current)return null;
   const pending=beginPendingCreate(ownerId);if(!pending)return null;
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
