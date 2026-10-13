'use client';
import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {api,ApiError} from './api';
import {useOperatorRead} from './useOperatorRead';
import {validateOrderDetail,orderDetailPath} from './operator-order-reads';
import type {OrderDetail} from './orders';
import type {DisputeDetail,DisputeListRow,DisputeStatus} from './disputes';
const modes=new Set(['DIRECT_PAYMENT','FREE_PILOT','PAID_MOCK','PAID_LIVE']);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string';const id=(v:unknown)=>text(v)&&(v as string).trim().length>0;
const nullableId=(v:unknown)=>v===null||id(v);const nullableText=(v:unknown)=>v===null||text(v);const nullableBool=(v:unknown)=>v===null||typeof v==='boolean';
function malformed():never{throw new Error('Malformed operator dispute response');}
function base(v:unknown):v is Record<string,unknown>{return object(v)&&id(v.id)&&nullableId(v.orderId)&&nullableId(v.plannedOrderId)&&!(v.orderId&&v.plannedOrderId)&&['CLIENT','MASTER'].includes(v.openedByRole as string)&&['OPEN','RESOLVED'].includes(v.status as string)&&text(v.createdAt);}
export function validateDisputeRows(value:unknown):DisputeListRow[]{if(!Array.isArray(value)||!value.every(base)||new Set(value.map(row=>row.id)).size!==value.length)malformed();return value as unknown as DisputeListRow[];}
export function validateOperatorDispute(value:unknown,expectedId:string):DisputeDetail{if(!base(value)||value.id!==expectedId||!text(value.reason)||!nullableText(value.counterStatement)||!Array.isArray(value.evidenceDocIds)||!value.evidenceDocIds.every(id)||new Set(value.evidenceDocIds).size!==value.evidenceDocIds.length||(value.commercialMode!==null&&!modes.has(value.commercialMode as string))||!nullableBool(value.refundServiceFee)||!nullableBool(value.penalizeMaster)||!nullableText(value.resolutionNote)||!nullableText(value.resolvedAt))malformed();return value as unknown as DisputeDetail;}
export const disputePath=(disputeId:string)=>`/admin/disputes/${encodeURIComponent(disputeId)}`;
async function readList(path:string,signal:AbortSignal){return validateDisputeRows(await api(path,{signal}));}
async function readDetail(path:string,signal:AbortSignal){return validateOperatorDispute(await api(path,{signal}),decodeURIComponent(path.split('/').pop()!));}
function related(dispute:DisputeDetail|null){return dispute?.orderId?{id:dispute.orderId,type:'urgent' as const}:dispute?.plannedOrderId?{id:dispute.plannedOrderId,type:'planned' as const}:null;}
export function useOperatorDisputeReads({ownerId,disputeId,status}:{ownerId:string|null;disputeId:string|null;status:DisputeStatus|'ALL'}){
 const list=useOperatorRead({ownerId,path:`/admin/disputes${status==='ALL'?'':`?status=${status}`}`,read:readList});
 const detail=useOperatorRead({ownerId:disputeId?ownerId:null,path:disputePath(disputeId??'unselected'),read:readDetail});const target=related(detail.data);
 const readOrder=useMemo(()=>async(path:string,signal:AbortSignal)=>{const url=new URL(path,'https://operator.invalid');return validateOrderDetail(await api(path,{signal}),{id:decodeURIComponent(url.pathname.split('/').pop()!),type:url.searchParams.get('type') as 'urgent'|'planned'});},[disputeId]);
 const order=useOperatorRead({ownerId:target?ownerId:null,path:orderDetailPath(target),read:readOrder});return{list,detail,order};
}
export function financialChoices(order:OrderDetail|null){if(!order)return{refund:false,penalty:false};if(order.type==='planned')return{refund:false,penalty:true};if(!modes.has(order.commercialMode)||order.lifecycleVersion>=2)return{refund:false,penalty:false};return{refund:['PAID_MOCK','PAID_LIVE'].includes(order.commercialMode),penalty:true};}
type Reads=ReturnType<typeof useOperatorDisputeReads>;
type Stage={verifiedDispute:()=>boolean;verifiedOrder:()=>boolean};
type Outcome={disputeId:string;pending:boolean;checking:boolean;error:boolean};
/** Only current-owner route memory; server status and financial rules remain authoritative. */
export function useOperatorResolution({ownerId,disputeId,detail,order,onReconciled}:{ownerId:string|null;disputeId:string|null;detail:Reads['detail'];order:Reads['order'];onReconciled:(disputeId:string)=>void}){
 const owner=useMemo(()=>({ownerId}),[ownerId]),context=useMemo(()=>({owner,disputeId}),[owner,disputeId]);
 const mounted=useRef(false),currentOwner=useRef(owner),currentContext=useRef(context),controllers=useRef(new Set<AbortController>()),records=useRef(new Map<string,Outcome>()),warnings=useRef(new Set<string>()),busy=useRef(false),revision=useRef(0),stageRef=useRef<Stage|null>(null),values=useRef({note:'',refund:false,penalty:false}),callback=useRef(onReconciled);callback.current=onReconciled;
 const [,rerender]=useState(0),[draft,setDraft]=useState({context,...values.current,stage:null as Stage|null});const update=()=>{if(mounted.current)rerender(n=>n+1);};
 useLayoutEffect(()=>{currentOwner.current=owner;mounted.current=true;records.current.clear();warnings.current.clear();busy.current=false;return()=>{mounted.current=false;for(const controller of controllers.current)controller.abort();controllers.current.clear();records.current.clear();warnings.current.clear();};},[owner]);
 useLayoutEffect(()=>{currentContext.current=context;revision.current++;stageRef.current=null;values.current={note:'',refund:false,penalty:false};setDraft({context,...values.current,stage:null});},[context]);
 const visible=draft.context===context?draft:{context,note:'',refund:false,penalty:false,stage:null};const draftRevision=revision.current;
 const valid=()=>!!ownerId&&!!disputeId&&mounted.current&&currentOwner.current===owner&&currentContext.current===context;
 const outcome=valid()?records.current.get(disputeId!)??null:null,choices=financialChoices(order.data);
 const eligible=()=>{const target=related(detail.data);return valid()&&detail.isVerifiedCurrent()&&detail.data?.id===disputeId&&detail.data.status==='OPEN'&&!!target&&order.isVerifiedCurrent()&&order.data?.id===target.id&&order.data.type===target.type&&(order.data.type==='planned'||(modes.has(order.data.commercialMode)&&detail.data.commercialMode===order.data.commercialMode));};
 const validDraft=()=>{const value=values.current;return!!value.note.trim()&&value.note.trim().length<=2000&&(!value.refund||choices.refund)&&(!value.penalty||choices.penalty);};
 function change(next:Partial<typeof values.current>){if(!valid())return;revision.current++;values.current={...values.current,...next};setDraft(previous=>({...previous,context,...values.current}));}
 function changeRefund(value:boolean){if(value&&(!eligible()||!choices.refund))return;change({refund:value});}
 function changePenalty(value:boolean){if(value&&(!eligible()||!choices.penalty))return;change({penalty:value});}
 function back(){if(!valid())return;stageRef.current=null;setDraft(previous=>({...previous,context,stage:null}));}
 function prepare(){if(!eligible()||!validDraft()||busy.current||records.current.has(disputeId!)||revision.current!==draftRevision)return;const stage={verifiedDispute:detail.isVerifiedCurrent,verifiedOrder:order.isVerifiedCurrent};stageRef.current=stage;setDraft(previous=>({...previous,context,stage}));}
 async function reconcileTarget(targetId:string){const record=records.current.get(targetId);if(!ownerId||!mounted.current||currentOwner.current!==owner||!record||record.pending||record.checking)return;record.checking=true;record.error=false;update();const controller=new AbortController();controllers.current.add(controller);
  try{const data=validateOperatorDispute(await api(disputePath(targetId),{signal:controller.signal}),targetId);const target=related(data);if(!target)throw new Error('Related order unavailable');validateOrderDetail(await api(orderDetailPath(target),{signal:controller.signal}),target);if(mounted.current&&currentOwner.current===owner&&records.current.get(targetId)===record&&!controller.signal.aborted){records.current.delete(targetId);callback.current(targetId);}}
  catch{if(mounted.current&&currentOwner.current===owner&&records.current.get(targetId)===record)record.error=true;}
  finally{controllers.current.delete(controller);if(mounted.current&&currentOwner.current===owner&&records.current.get(targetId)===record)record.checking=false;update();}
 }
 async function submit(){const stage=visible.stage;if(!disputeId||!eligible()||!validDraft()||!stage||stageRef.current!==stage||!stage.verifiedDispute()||!stage.verifiedOrder()||revision.current!==draftRevision||busy.current||records.current.has(disputeId))return;busy.current=true;const record:Outcome={disputeId,pending:true,checking:false,error:false};records.current.set(disputeId,record);update();const controller=new AbortController();controllers.current.add(controller);let succeeded=false;
  try{await api(`${disputePath(disputeId)}/resolve`,{method:'POST',body:JSON.stringify({refundServiceFee:values.current.refund,penalizeMaster:values.current.penalty,resolutionNote:values.current.note.trim()}),signal:controller.signal});succeeded=true;}catch(error){if(mounted.current&&currentOwner.current===owner&&records.current.get(disputeId)===record){record.error=true;if(error instanceof ApiError&&error.status===503)warnings.current.add(disputeId);}}
  finally{controllers.current.delete(controller);if(mounted.current&&currentOwner.current===owner&&records.current.get(disputeId)===record){record.pending=false;busy.current=false;update();if(succeeded)void reconcileTarget(disputeId);}}
 }
 return{contextVerified:eligible(),note:visible.note,refund:visible.refund,penalty:visible.penalty,stage:visible.stage,outcome,choices,warning503:valid()&&warnings.current.has(disputeId!),changeNote:(value:string)=>change({note:value}),changeRefund,changePenalty,clearFinancial:()=>change({refund:false,penalty:false}),back,prepare,submit,reconcile:()=>{if(valid())return reconcileTarget(disputeId!);},canPrepare:eligible()&&validDraft()&&!busy.current&&!outcome,canSubmit:eligible()&&validDraft()&&!!visible.stage&&stageRef.current===visible.stage&&visible.stage.verifiedDispute()&&visible.stage.verifiedOrder()&&revision.current===draftRevision&&!busy.current&&!outcome};
}
