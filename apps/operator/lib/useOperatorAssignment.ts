'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import {orderDetailPath,validateOrderDetail,validateCandidates,type OrderSelection} from './operator-order-reads';
type UnknownRecord={target:OrderSelection;pending:boolean;checking:boolean;error:boolean};
const key=(target:OrderSelection)=>`${target.type}:${target.id}`;
/** Current-owner memory only. Unknown outcomes outlive closing/changing the selected editor. */
export function useOperatorAssignment(onReconciled:(target:OrderSelection)=>void){
 const records=useRef(new Map<string,UnknownRecord>()),mounted=useRef(false),busy=useRef(false),controllers=useRef(new Set<AbortController>()),callback=useRef(onReconciled);callback.current=onReconciled;
 const [,render]=useState(0);const update=()=>{if(mounted.current)render(n=>n+1);};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;for(const controller of controllers.current)controller.abort();controllers.current.clear();records.current.clear();};},[]);
 async function reconcile(target:OrderSelection){const record=records.current.get(key(target));if(!mounted.current||!record||record.pending||record.checking)return;record.checking=true;record.error=false;update();const controller=new AbortController();controllers.current.add(controller);
  try{const [detail,candidates]=await Promise.all([api(orderDetailPath(target),{signal:controller.signal}),api(`/admin/orders/${encodeURIComponent(target.id)}/candidates?type=urgent`,{signal:controller.signal})]);validateOrderDetail(detail,target);validateCandidates(candidates);if(mounted.current&&records.current.get(key(target))===record&&!controller.signal.aborted){records.current.delete(key(target));callback.current(target);}}
  catch{if(mounted.current&&records.current.get(key(target))===record)record.error=true;}
  finally{controllers.current.delete(controller);if(mounted.current&&records.current.get(key(target))===record)record.checking=false;update();}
 }
 async function assign(target:OrderSelection,masterUserId:string,verified:()=>boolean){if(!mounted.current||busy.current||records.current.has(key(target))||target.type!=='urgent'||!verified())return;busy.current=true;const record:UnknownRecord={target,pending:true,checking:false,error:false};records.current.set(key(target),record);update();const controller=new AbortController();controllers.current.add(controller);let succeeded=false;
  try{await api(`/admin/orders/${encodeURIComponent(target.id)}/assign?type=urgent`,{method:'POST',body:JSON.stringify({masterUserId}),signal:controller.signal});succeeded=true;}catch{if(mounted.current&&records.current.get(key(target))===record)record.error=true;}
  finally{controllers.current.delete(controller);if(mounted.current&&records.current.get(key(target))===record){record.pending=false;busy.current=false;update();if(succeeded)void reconcile(target);}}
 }
 return{getRecord:(target:OrderSelection|null)=>target?records.current.get(key(target))??null:null,isBusy:()=>busy.current,assign,reconcile};
}
