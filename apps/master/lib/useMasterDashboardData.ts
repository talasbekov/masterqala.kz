'use client';
import {useCallback,useEffect} from 'react';
import {useOwnedAccountResource,type AccountApi} from '@masterqala/ui';
import {api as defaultApi,ApiError} from './api';
import {getSocket as defaultGetSocket} from './socket';
import type {Application} from './masterApplication';
import type {ActiveOrder} from './activeOrder';
import type {MasterStats} from './masterStats';

type StatusSocket={on:(event:string,handler:()=>void)=>unknown;off:(event:string,handler:()=>void)=>unknown};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const nonempty=(value:unknown):value is string=>typeof value==='string'&&!!value.trim();
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
function applicationResponse(value:unknown):Application{
 if(!record(value)||!nonempty(value.id)||!nonempty(value.fullName)||!['PENDING_REVIEW','NEEDS_INFO','ACTIVE','REJECTED'].includes(String(value.status))||!Array.isArray(value.categories)||!Array.isArray(value.documents))throw new Error('Invalid application response');
 return value as unknown as Application;
}
function statsResponse(value:unknown):MasterStats{
 if(!record(value)||!finite(value.completedCount)||value.completedCount<0||!finite(value.reviewCount)||value.reviewCount<0||!(value.rating===null||finite(value.rating)))throw new Error('Invalid master statistics response');
 return value as unknown as MasterStats;
}
function activeResponse(value:unknown):ActiveOrder|null{
 if(!record(value)||!Object.hasOwn(value,'order'))throw new Error('Invalid active order response');
 if(value.order===null)return null;
 if(!record(value.order)||!nonempty(value.order.id)||!nonempty(value.order.status))throw new Error('Invalid active order response');
 return value.order as unknown as ActiveOrder;
}
/** Independent owner-scoped GETs; a failed source never erases another valid source. */
export function useMasterDashboardData({ownerId,api=defaultApi,getSocket=defaultGetSocket}:{ownerId:string|null;api?:AccountApi;getSocket?:()=>StatusSocket}){
 const readApplication=useCallback(async(path:string)=>{try{return applicationResponse(await api(path));}catch(error){if(error instanceof ApiError&&error.status===404)return null;throw error;}},[api]);
 const readStats=useCallback(async(path:string)=>statsResponse(await api(path)),[api]);
 const readActive=useCallback(async(path:string)=>activeResponse(await api(path)),[api]);
 const application=useOwnedAccountResource<Application|null>({ownerId,path:'/masters/application',api:readApplication});
 const stats=useOwnedAccountResource<MasterStats>({ownerId,path:'/masters/me/stats',api:readStats});
 const activeOwner=application.data?.status==='ACTIVE'?ownerId:null;
 const active=useOwnedAccountResource<ActiveOrder|null>({ownerId:activeOwner,path:'/master/active-order',api:readActive});
 useEffect(()=>{
  if(!activeOwner)return;
  const socket=getSocket();let live=true;
  const onStatus=()=>{if(live)void active.retry();};
  socket.on('order:status',onStatus);
  return()=>{live=false;socket.off('order:status',onStatus);};
 },[activeOwner,getSocket,active.retry]);
 return {application,stats,active};
}
