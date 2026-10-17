'use client';
import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {api,ApiError} from './api';
import {useOperatorRead} from './useOperatorRead';
import {documentIsViewable,type ApplicationDetail,type ApplicationListItem,type DecisionType} from './verification';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string';
const id=(v:unknown)=>text(v)&&(v as string).trim().length>0;
const nullableText=(v:unknown)=>v===null||text(v);
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const statuses=new Set(['PENDING_REVIEW','NEEDS_INFO','ACTIVE','REJECTED']);
const decisions=new Set(['APPROVE','REJECT','REQUEST_INFO']);
function malformed():never{throw new Error('Malformed verification response');}
function category(v:unknown){return object(v)&&object(v.category)&&text(v.category.name);}
function base(v:unknown):v is Record<string,unknown>{return object(v)&&id(v.id)&&text(v.fullName)&&text(v.district)&&statuses.has(v.status as string)&&text(v.createdAt)&&object(v.user)&&id(v.user.phone)&&Array.isArray(v.categories)&&v.categories.every(category);}
export function validateApplications(value:unknown):ApplicationListItem[]{if(!Array.isArray(value)||!value.every(base)||new Set(value.map(row=>row.id)).size!==value.length)malformed();return value as unknown as ApplicationListItem[];}
export function validateApplication(value:unknown,profileId:string):ApplicationDetail{
 if(!base(value)||value.id!==profileId||!text(value.iin)||!integer(value.experienceYears)||!nullableText(value.rejectionReason)||!Array.isArray(value.documents)||!Array.isArray(value.decisions))malformed();
 for(const doc of value.documents)if(!object(doc)||!id(doc.id)||doc.masterProfileId!==profileId||!['ID_CARD','QUALIFICATION'].includes(doc.type as string)||!text(doc.filePath)||!text(doc.originalName)||!text(doc.mimeType)||!integer(doc.sizeBytes)||!text(doc.createdAt)||!id(doc.scanStatus)||!nullableText(doc.scannedAt)||!id(doc.cdrStatus))malformed();
 if(new Set(value.documents.map(doc=>doc.id)).size!==value.documents.length)malformed();
 for(const decision of value.decisions)if(!object(decision)||!decisions.has(decision.decision as string)||!nullableText(decision.comment)||!text(decision.createdAt)||!object(decision.operator)||!nullableText(decision.operator.name)||!id(decision.operator.phone))malformed();
 return value as unknown as ApplicationDetail;
}
export const applicationPath=(profileId:string)=>`/admin/applications/${encodeURIComponent(profileId)}`;
async function readList(path:string,signal:AbortSignal){return validateApplications(await api(path,{signal}));}
async function readDetail(path:string,signal:AbortSignal){const profileId=decodeURIComponent(path.split('/').pop()!);return validateApplication(await api(path,{signal}),profileId);}
export function useVerificationReads({ownerId,profileId}:{ownerId:string|null;profileId:string|null}){const list=useOperatorRead({ownerId,path:'/admin/applications',read:readList});const detail=useOperatorRead({ownerId:profileId?ownerId:null,path:applicationPath(profileId??'unselected'),read:readDetail});return{list,detail};}
type DetailRead=ReturnType<typeof useVerificationReads>['detail'];
type Stage={decision:DecisionType;verified:()=>boolean};
type Outcome={profileId:string;pending:boolean;checking:boolean;error:boolean;rejected?:boolean};
const precommitRefusals=new Set([400,401,403,404,409]);
const recoveryKey=(ownerId:string,profileId:string,kind:'draft'|'outcome')=>`mq:operator:verification:${encodeURIComponent(ownerId)}:${encodeURIComponent(profileId)}:${kind}`;
/** Tab-local recovery contains only a comment and an unresolved-attempt marker, never server data. */
export function useVerificationDecision({ownerId,profileId,detail,onReconciled}:{ownerId:string|null;profileId:string|null;detail:DetailRead;onReconciled:(profileId:string)=>void}){
 const owner=useMemo(()=>({ownerId}),[ownerId]),context=useMemo(()=>({owner,profileId}),[owner,profileId]);
 const mounted=useRef(false),currentOwner=useRef(owner),currentContext=useRef(context),controllers=useRef(new Set<AbortController>()),records=useRef(new Map<string,Outcome>()),busy=useRef(false),revision=useRef(0),stageRef=useRef<Stage|null>(null),commentRef=useRef(''),callback=useRef(onReconciled);callback.current=onReconciled;
 const [,rerender]=useState(0),[persistenceError,setPersistenceError]=useState(false),[draft,setDraft]=useState({context,comment:'',stage:null as Stage|null});const update=()=>{if(mounted.current)rerender(n=>n+1);};
 useLayoutEffect(()=>{currentOwner.current=owner;mounted.current=true;records.current.clear();busy.current=false;return()=>{mounted.current=false;for(const controller of controllers.current)controller.abort();controllers.current.clear();records.current.clear();};},[owner]);
 useLayoutEffect(()=>{currentContext.current=context;revision.current++;stageRef.current=null;let comment='';setPersistenceError(false);
  if(ownerId&&profileId)try{const saved=window.sessionStorage.getItem(recoveryKey(ownerId,profileId,'draft'));if(saved!==null&&saved.length<=10000)comment=saved;const marker=window.sessionStorage.getItem(recoveryKey(ownerId,profileId,'outcome'));if(marker!==null&&!records.current.has(profileId))records.current.set(profileId,{profileId,pending:false,checking:false,error:false,rejected:marker==='rejected'});}catch{setPersistenceError(true);}
  commentRef.current=comment;setDraft({context,comment,stage:null});
 },[context,ownerId,profileId]);
 const visible=draft.context===context?draft:{context,comment:'',stage:null};const draftRevision=revision.current;
 const validContext=()=>!!ownerId&&!!profileId&&mounted.current&&currentOwner.current===owner&&currentContext.current===context;
 const outcome=validContext()?records.current.get(profileId!)??null:null;
 const eligible=()=>validContext()&&detail.isVerifiedCurrent()&&detail.data?.id===profileId&&detail.data.status==='PENDING_REVIEW'&&detail.data.documents.every(documentIsViewable);
 function setComment(value:string){if(!validContext())return;revision.current++;commentRef.current=value;setDraft(previous=>({...previous,context,comment:value}));try{if(value)window.sessionStorage.setItem(recoveryKey(ownerId!,profileId!,'draft'),value);else window.sessionStorage.removeItem(recoveryKey(ownerId!,profileId!,'draft'));setPersistenceError(false);}catch{setPersistenceError(true);}}
 function back(){if(!validContext())return;stageRef.current=null;setDraft(previous=>({...previous,context,stage:null}));}
 function chooseDecision(decision:DecisionType){if(!eligible()||busy.current||records.current.has(profileId!)||revision.current!==draftRevision||!decisions.has(decision))return;const stage={decision,verified:detail.isVerifiedCurrent};stageRef.current=stage;setDraft(previous=>({...previous,context,stage}));}
 async function reconcileTarget(target:string){const record=records.current.get(target);if(!ownerId||!mounted.current||currentOwner.current!==owner||!record||record.pending||record.checking)return;record.checking=true;record.error=false;update();const controller=new AbortController();controllers.current.add(controller);
  try{const application=validateApplication(await api(applicationPath(target),{signal:controller.signal}),target);if(mounted.current&&currentOwner.current===owner&&records.current.get(target)===record&&!controller.signal.aborted){
   // PENDING_REVIEW can race the original POST. A read of it cannot establish failure.
   if(application.status==='PENDING_REVIEW'&&!record.rejected)return;
   window.sessionStorage.removeItem(recoveryKey(ownerId,target,'outcome'));records.current.delete(target);if(currentContext.current.profileId===target){stageRef.current=null;setDraft(previous=>({...previous,stage:null}));setPersistenceError(false);}callback.current(target);}}
  catch{if(mounted.current&&currentOwner.current===owner&&records.current.get(target)===record)record.error=true;}
  finally{controllers.current.delete(controller);if(mounted.current&&currentOwner.current===owner&&records.current.get(target)===record)record.checking=false;update();}
 }
 async function submit(){const stage=visible.stage;if(!profileId||!eligible()||!stage||stageRef.current!==stage||!stage.verified()||revision.current!==draftRevision||busy.current||records.current.has(profileId))return;const comment=commentRef.current.trim();if(comment.length>1000||(stage.decision!=='APPROVE'&&!comment))return;
  // Persist before dispatch. A failed write must never leave an untracked POST after a reload.
  try{const marker=window.sessionStorage.getItem(recoveryKey(ownerId!,profileId,'outcome'));if(marker!==null){records.current.set(profileId,{profileId,pending:false,checking:false,error:false,rejected:marker==='rejected'});update();return;}window.sessionStorage.setItem(recoveryKey(ownerId!,profileId,'outcome'),'1');setPersistenceError(false);}catch{setPersistenceError(true);return;}
  busy.current=true;const record:Outcome={profileId,pending:true,checking:false,error:false};records.current.set(profileId,record);update();const controller=new AbortController();controllers.current.add(controller);let succeeded=false;
  try{await api(`${applicationPath(profileId)}/decision`,{method:'POST',body:JSON.stringify({decision:stage.decision,...(comment?{comment}:{})}),signal:controller.signal});succeeded=true;}catch(error){if(mounted.current&&currentOwner.current===owner&&records.current.get(profileId)===record){
   // These endpoint responses reject before committing; network/5xx failures remain ambiguous.
   record.rejected=error instanceof ApiError&&precommitRefusals.has(error.status);record.error=!record.rejected;
   if(record.rejected)try{window.sessionStorage.setItem(recoveryKey(ownerId!,profileId,'outcome'),'rejected');}catch{setPersistenceError(true);}
  }}
  finally{controllers.current.delete(controller);if(mounted.current&&currentOwner.current===owner&&records.current.get(profileId)===record){record.pending=false;busy.current=false;update();if(succeeded)void reconcileTarget(profileId);}}
 }
 return{comment:visible.comment,stage:visible.stage,outcome,persistenceError,setComment,back,chooseDecision,submit,reconcile:()=>{if(validContext())return reconcileTarget(profileId!);},canChoose:eligible()&&!busy.current&&!outcome,canSubmit:eligible()&&!!visible.stage&&stageRef.current===visible.stage&&visible.stage.verified()&&revision.current===draftRevision&&!busy.current&&!outcome&&commentRef.current.trim().length<=1000&&(visible.stage.decision==='APPROVE'||!!commentRef.current.trim())};
}
