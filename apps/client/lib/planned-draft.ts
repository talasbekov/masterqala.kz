import {getDraftStorage,emptyNewOrderDraft,currentOrderSubmission} from './new-order-draft';
export const PLANNED_DRAFT_KEY='mq.desktop.planned-draft.v1';
export const SERVICE_TIME_ZONE='Asia/Almaty';
export const PLANNED_SLOTS=[{start:8,end:10},{start:10,end:13},{start:13,end:16},{start:16,end:19}] as const;
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export interface PlannedDraft {categoryId:string;description:string;address:string;district:string;entrance:string;floor:string;apartment:string;addressComment:string;photoPaths:string[];date:string;slotIndex:number;budget:string;}
export interface PlannedPayload {categoryId:string;description:string;address:string;district:string;entrance?:string;floor?:string;apartment?:string;addressComment?:string;photoPaths:string[];slotStart:string;slotEnd:string;budget?:number;}
export interface PlannedPending {clientRequestId:string;payload:PlannedPayload;}
export interface PlannedState {draft:PlannedDraft;pending:PlannedPending|null;completedOrderId:string|null;uncertain:boolean;}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function localServiceDate(now=Date.now()):string {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:SERVICE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-');
}
export function addCalendarDays(date:string,days:number):string{return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function emptyPlannedDraft(now=Date.now()):PlannedDraft{return {categoryId:'',description:'',address:'',district:'',entrance:'',floor:'',apartment:'',addressComment:'',photoPaths:[],date:addCalendarDays(localServiceDate(now),1),slotIndex:1,budget:''};}
function validDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;}
export function serviceSlot(date:string,slotIndex:number):{slotStart:string;slotEnd:string}|null {
 if(!validDate(date)||!Number.isInteger(slotIndex)||!PLANNED_SLOTS[slotIndex])return null;
 const [year,month,day]=date.split('-').map(Number);
 function atHour(hour:number){
  const desired=Date.UTC(year,month-1,day,hour);
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:SERVICE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(desired);
  const n=(type:string)=>Number(parts.find(p=>p.type===type)!.value);
  const offset=Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'),n('second'))-desired;
  return new Date(desired-offset).toISOString();
 }
 return {slotStart:atHour(PLANNED_SLOTS[slotIndex].start),slotEnd:atHour(PLANNED_SLOTS[slotIndex].end)};
}
function sanitized(value:unknown):PlannedDraft|null {
 if(!value||typeof value!=='object')return null;const d=value as PlannedDraft,result=emptyPlannedDraft();
 const limits={categoryId:100,description:2000,address:500,district:200,entrance:50,floor:50,apartment:50,addressComment:500,budget:10,date:10};
 for(const key of Object.keys(limits) as (keyof typeof limits)[]){if(typeof d[key]!=='string'||d[key].length>limits[key])return null;result[key]=d[key];}
 if(!Number.isInteger(d.slotIndex)||d.slotIndex<0||d.slotIndex>3||!Array.isArray(d.photoPaths)||d.photoPaths.length>5||d.photoPaths.some(p=>typeof p!=='string'||p.length>100))return null;
 result.slotIndex=d.slotIndex;result.photoPaths=[...d.photoPaths];return result;
}
export function plannedSubmission(draft:PlannedDraft,now=Date.now()):PlannedPayload|null {
 const d=sanitized(draft);if(!d)return null;
 const base=currentOrderSubmission({...emptyNewOrderDraft(),...d,addressText:d.address.trim(),description:d.description.trim(),district:d.district.trim()});
 const slot=serviceSlot(d.date,d.slotIndex);if(!base||!slot||Date.parse(slot.slotStart)<=now||Date.parse(slot.slotStart)>now+14*86400000)return null;
 if(d.budget&&(!/^\d+$/.test(d.budget)||!Number.isSafeInteger(Number(d.budget))||Number(d.budget)>2147483647))return null;
 const {lat:_lat,lng:_lng,...payload}=base;return {...payload,...slot,...(d.budget?{budget:Number(d.budget)}:{})};
}
function validPending(value:unknown):value is PlannedPending {
 if(!value||typeof value!=='object')return false;const p=value as PlannedPending,d=p.payload;
 if(!uuid.test(p.clientRequestId)||!d||!currentOrderSubmission({...emptyNewOrderDraft(),...d,addressText:d.address})||!Number.isFinite(Date.parse(d.slotStart))||!Number.isFinite(Date.parse(d.slotEnd))||Date.parse(d.slotEnd)<=Date.parse(d.slotStart))return false;
 return d.budget===undefined||(Number.isInteger(d.budget)&&d.budget>=0&&d.budget<=2147483647);
}
export function readPlannedState(ownerId:string,storage:Store|undefined=getDraftStorage()):PlannedState|null {
 try{const raw=storage?.getItem(PLANNED_DRAFT_KEY);if(!raw)return null;const r=JSON.parse(raw);if(r.ownerId!==ownerId)return null;const draft=sanitized(r.draft);if(!draft)return {draft:emptyPlannedDraft(),pending:null,completedOrderId:null,uncertain:true};return {draft,pending:validPending(r.pending)?r.pending:null,completedOrderId:typeof r.completedOrderId==='string'?r.completedOrderId:null,uncertain:!!r.pending&&!validPending(r.pending)};}catch{return {draft:emptyPlannedDraft(),pending:null,completedOrderId:null,uncertain:true};}
}
function write(ownerId:string,state:PlannedState,storage:Store|undefined){if(!ownerId||!storage)return false;try{storage.setItem(PLANNED_DRAFT_KEY,JSON.stringify({schemaVersion:1,ownerId,...state}));return true;}catch{return false;}}
export function savePlannedDraft(ownerId:string,value:PlannedDraft,storage:Store|undefined=getDraftStorage()):boolean {
 const d=sanitized(value),current=readPlannedState(ownerId,storage);if(!d||current?.pending||current?.uncertain||current?.completedOrderId)return false;
 return write(ownerId,{draft:d,pending:null,completedOrderId:null,uncertain:false},storage);
}
export function beginPlannedSubmission(ownerId:string,draft:PlannedDraft,storage:Store|undefined=getDraftStorage(),now=Date.now()):PlannedPending|null {
 const current=readPlannedState(ownerId,storage);if(current?.pending||current?.uncertain||current?.completedOrderId)return null;const payload=plannedSubmission(draft,now);if(!payload)return null;
 const pending={clientRequestId:globalThis.crypto.randomUUID(),payload};return write(ownerId,{draft,pending,completedOrderId:null,uncertain:false},storage)?pending:null;
}
export function settlePlannedSubmission(ownerId:string,requestId:string,orderId:string,storage:Store|undefined=getDraftStorage()):boolean {
 const state=readPlannedState(ownerId,storage);if(!orderId||!state?.pending||state.pending.clientRequestId!==requestId)return false;
 return write(ownerId,{draft:emptyPlannedDraft(),pending:null,completedOrderId:orderId,uncertain:false},storage);
}
export function clearPlannedDraft(storage:Store|undefined=getDraftStorage()):void{try{storage?.removeItem(PLANNED_DRAFT_KEY);}catch{/* Optional tab storage. */}}
