'use client';
import {api} from './api';
import {useOperatorRead} from './useOperatorRead';
import type {AssignCandidate,OrderDetail,OrderListRow,OrderType} from './orders';
export type OrderSelection={id:string;type:OrderType};
export type OrderFilters={type:OrderType|'ALL';status:string;search:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string';
const id=(v:unknown)=>text(v)&&(v as string).trim().length>0;
const nullableText=(v:unknown)=>v===null||text(v);
const amount=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const nullableAmount=(v:unknown)=>v===null||amount(v);
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const type=(v:unknown)=>v==='urgent'||v==='planned';
const person=(v:unknown)=>object(v)&&nullableText(v.name)&&id(v.phone);
function malformed():never{throw new Error('Malformed operator order response');}
function unique<T>(rows:T[],key:(row:T)=>string){if(new Set(rows.map(key)).size!==rows.length)malformed();return rows;}
export function validateOrderRows(value:unknown):OrderListRow[]{
 if(!Array.isArray(value)||value.length>100)malformed();
 for(const row of value)if(!object(row)||!id(row.id)||!type(row.type)||!text(row.client)||!nullableText(row.master)||!text(row.category)||!id(row.status)||!text(row.createdAt))malformed();
 return unique(value as OrderListRow[],row=>`${row.type}:${row.id}`);
}
export function validateOrderDetail(value:unknown,expected:OrderSelection):OrderDetail{
 if(!object(value)||value.id!==expected.id||value.type!==expected.type||!id(value.status)||!text(value.address)||!text(value.district)||!text(value.createdAt)||!person(value.client)||(value.master!==null&&!person(value.master))||!text(value.category)||!nullableAmount(value.workPrice)||typeof value.canAssign!=='boolean'||!Array.isArray(value.timeline)||!value.timeline.every(event=>object(event)&&text(event.at)&&text(event.event)))malformed();
 if(value.type==='urgent'){if(!amount(value.calloutPrice)||!amount(value.serviceFee)||!integer(value.lifecycleVersion)||!id(value.commercialMode)||!nullableAmount(value.cancellationAmount)||!amount(value.materialsPrice)||!nullableAmount(value.quoteTotal)||!integer(value.quoteVersion)||(value.consentedVersion!==null&&!integer(value.consentedVersion)))malformed();}
 else if(!nullableAmount(value.budget)||value.canAssign!==false)malformed();
 return value as unknown as OrderDetail;
}
export function validateCandidates(value:unknown):AssignCandidate[]{
 if(!Array.isArray(value)||value.length>10)malformed();
 for(const row of value)if(!object(row)||!id(row.masterUserId)||!text(row.name)||!amount(row.distanceKm)||typeof row.isOnline!=='boolean')malformed();
 return unique(value as AssignCandidate[],row=>row.masterUserId);
}
export function orderListPath(filters:OrderFilters){const q=new URLSearchParams();if(filters.type!=='ALL')q.set('type',filters.type);if(filters.status)q.set('status',filters.status);if(filters.search.trim())q.set('search',filters.search.trim());return `/admin/orders${q.size?`?${q}`:''}`;}
export function orderDetailPath(selected:OrderSelection|null){return selected?`/admin/orders/${encodeURIComponent(selected.id)}?type=${selected.type}`:'/admin/orders/unselected';}
function delay(signal:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(new DOMException('Cancelled','AbortError'));return;}const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('Cancelled','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},400);signal.addEventListener('abort',abort,{once:true});});}
async function readList(path:string,signal:AbortSignal){await delay(signal);return validateOrderRows(await api(path,{signal}));}
async function readDetail(path:string,signal:AbortSignal){const url=new URL(path,'https://operator.invalid');const expected={id:decodeURIComponent(url.pathname.split('/').pop()!),type:url.searchParams.get('type') as OrderType};return validateOrderDetail(await api(path,{signal}),expected);}
async function readCandidates(path:string,signal:AbortSignal){return validateCandidates(await api(path,{signal}));}
/** Independent private resources; callers key selection/editor state by owner lifetime. */
export function useOperatorOrdersReads({ownerId,filters,selected,candidatesOpen}:{ownerId:string|null;filters:OrderFilters;selected:OrderSelection|null;candidatesOpen:boolean}){
 const list=useOperatorRead({ownerId,path:orderListPath(filters),read:readList});
 const detail=useOperatorRead({ownerId:selected?ownerId:null,path:orderDetailPath(selected),read:readDetail});
 const candidates=useOperatorRead({ownerId:selected?.type==='urgent'&&candidatesOpen?ownerId:null,path:selected?`/admin/orders/${encodeURIComponent(selected.id)}/candidates?type=urgent`:'/admin/orders/unselected/candidates?type=urgent',read:readCandidates});
 return{list,detail,candidates};
}
