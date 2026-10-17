'use client';
import {useLayoutEffect,useRef,useState} from 'react';
import {api,ApiError} from './api';
import {orderDetailPath,validateOrderDetail,validateCandidates,type OrderSelection} from './operator-order-reads';
import {readAssignmentRecovery,saveAssignmentRecovery,clearAssignmentRecovery} from './operator-order-recovery';
type UnknownRecord={target:OrderSelection;pending:boolean;checking:boolean;error:boolean;rejected:boolean};
const key=(target:OrderSelection)=>`${target.type}:${target.id}`;
/** Persist the lock before sending. A reload never turns an unknown write into a retry. */
export function useOperatorAssignment(ownerId:string|null,onReconciled:(target:OrderSelection)=>void){
 const records=useRef(new Map<string,UnknownRecord>()),mounted=useRef(false),busy=useRef(false),controllers=useRef(new Set<AbortController>()),callback=useRef(onReconciled);callback.current=onReconciled;
 const [storageUnavailable,setStorageUnavailable]=useState(false),[,render]=useState(0);const update=()=>{if(mounted.current)render(n=>n+1);};
 useLayoutEffect(()=>{
  mounted.current=true;
  try{if(ownerId)for(const {target,rejected} of readAssignmentRecovery(ownerId))records.current.set(key(target),{target,rejected,pending:false,checking:false,error:false});}catch{setStorageUnavailable(true);}
  update();
  return()=>{mounted.current=false;for(const controller of controllers.current)controller.abort();controllers.current.clear();records.current.clear();};
 },[ownerId]);
 async function reconcile(target:OrderSelection){const record=records.current.get(key(target));if(!ownerId||!mounted.current||!record||record.pending||record.checking)return;record.checking=true;record.error=false;update();const controller=new AbortController();controllers.current.add(controller);
  try{
   const [detail,candidates]=await Promise.all([api(orderDetailPath(target),{signal:controller.signal}),api(`/admin/orders/${encodeURIComponent(target.id)}/candidates?type=urgent`,{signal:controller.signal})]);
   const verified=validateOrderDetail(detail,target);validateCandidates(candidates);
   if(mounted.current&&records.current.get(key(target))===record&&!controller.signal.aborted){
    // A received rejection can be retried after fresh reads and a new choice.
    // Ambiguous outcomes can still race the original POST and remain locked.
    if(record.rejected||!verified.canAssign){clearAssignmentRecovery(ownerId,target);records.current.delete(key(target));}
    callback.current(target);
   }
  }catch{if(mounted.current&&records.current.get(key(target))===record)record.error=true;}
  finally{controllers.current.delete(controller);if(mounted.current&&records.current.get(key(target))===record)record.checking=false;update();}
 }
 async function assign(target:OrderSelection,masterUserId:string,verified:()=>boolean){
  if(!ownerId||!mounted.current||busy.current||storageUnavailable||records.current.has(key(target))||target.type!=='urgent'||!verified())return;
  try{
   for(const previous of readAssignmentRecovery(ownerId))if(key(previous.target)===key(target)){records.current.set(key(target),{target,rejected:previous.rejected,pending:false,checking:false,error:false});update();return;}
   saveAssignmentRecovery(ownerId,target);
  }catch{setStorageUnavailable(true);return;}
  busy.current=true;const record:UnknownRecord={target,pending:true,checking:false,error:false,rejected:false};records.current.set(key(target),record);update();const controller=new AbortController();controllers.current.add(controller);let succeeded=false;
  try{await api(`/admin/orders/${encodeURIComponent(target.id)}/assign?type=urgent`,{method:'POST',body:JSON.stringify({masterUserId}),signal:controller.signal});succeeded=true;}
  catch(error){if(mounted.current&&records.current.get(key(target))===record){
   record.error=true;
   if(error instanceof ApiError&&[400,401,403,404,409].includes(error.status)){
    record.rejected=true;record.error=false;
    try{saveAssignmentRecovery(ownerId,target,true);}catch{setStorageUnavailable(true);}
   }
  }}
  finally{controllers.current.delete(controller);if(mounted.current&&records.current.get(key(target))===record){record.pending=false;busy.current=false;update();if(succeeded)void reconcile(target);}}
 }
 return{getRecord:(target:OrderSelection|null)=>target?records.current.get(key(target))??null:null,isBusy:()=>busy.current,storageUnavailable,assign,reconcile};
}
