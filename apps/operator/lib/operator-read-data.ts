import {api} from './api';
import type {Category,OperatorMasterRow} from './masters';
import type {JournalPage} from './journal';
const record=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string';
const id=(value:unknown):value is string=>text(value)&&!!value.trim();
const count=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0;
function unique(rows:{id:string}[]){return new Set(rows.map(row=>row.id)).size===rows.length;}
export async function readOperatorCategories(path:string,signal:AbortSignal):Promise<Category[]> {
 const value=await api(path,{signal});if(!Array.isArray(value)||!value.every(row=>record(row)&&id(row.id)&&id(row.slug)&&id(row.name))||!unique(value))throw new Error('Invalid category response');return value;
}
function debounce(signal:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(new DOMException('Read cancelled','AbortError'));return;}const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('Read cancelled','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},400);signal.addEventListener('abort',abort,{once:true});});}
export async function readOperatorMasters(path:string,signal:AbortSignal):Promise<OperatorMasterRow[]> {
 await debounce(signal);if(signal.aborted)throw new DOMException('Read cancelled','AbortError');
 const value=await api(path,{signal});if(!Array.isArray(value)||!value.every(row=>record(row)&&id(row.id)&&(row.name===null||text(row.name))&&Array.isArray(row.categories)&&row.categories.every(text)&&count(row.orders)&&text(row.status)&&(row.rating===null||typeof row.rating==='number'&&Number.isFinite(row.rating)&&row.rating>=0&&row.rating<=5)&&count(row.reviewCount))||!unique(value))throw new Error('Invalid master response');return value;
}
export async function readOperatorJournal(path:string,signal:AbortSignal):Promise<JournalPage> {
 const value=await api(path,{signal});const expected=Number(new URL(path,'https://operator.local').searchParams.get('page'));
 if(!record(value)||value.page!==expected||!count(value.page)||value.page<1||!count(value.pageSize)||value.pageSize<1||!count(value.total)||!Array.isArray(value.rows)||value.rows.length>value.pageSize||!value.rows.every(row=>record(row)&&id(row.id)&&['OPERATOR','SYSTEM'].includes(row.actorType)&&(row.actorId===null||id(row.actorId))&&id(row.action)&&['MASTER_PROFILE','USER','ORDER','PLANNED_ORDER','DISPUTE','WITHDRAWAL'].includes(row.targetType)&&id(row.targetId)&&(row.comment===null||text(row.comment))&&text(row.createdAt)&&(row.actor===null||record(row.actor)&&(row.actor.name===null||text(row.actor.name))&&text(row.actor.phone)))||!unique(value.rows))throw new Error('Invalid journal response');
 return value as unknown as JournalPage;
}
