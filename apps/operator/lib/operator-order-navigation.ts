'use client';
import {useLayoutEffect,useState} from 'react';
import {STATUS_LABELS,PLANNED_STATUS_LABELS} from './orders';
import type {OrderFilters,OrderSelection} from './operator-order-reads';

export type OrderLocation={filters:OrderFilters;selected:OrderSelection|null};
const empty=():OrderLocation=>({filters:{type:'ALL',status:'',search:''},selected:null});
const orderType=(value:string|null)=>value?.toLowerCase()==='urgent'?'urgent':value?.toLowerCase()==='planned'?'planned':null;
/** Selection always includes its type: urgent and planned IDs may overlap. */
export function parseOrderLocation(search:string):OrderLocation{
 const params=new URLSearchParams(search),type=orderType(params.get('type')),id=params.get('id');
 const filter=params.has('filter')?orderType(params.get('filter')):type;
 const status=params.get('status')??'',known=filter==='urgent'?STATUS_LABELS:filter==='planned'?PLANNED_STATUS_LABELS:{...STATUS_LABELS,...PLANNED_STATUS_LABELS};
 return{filters:{type:filter??'ALL',status:Object.hasOwn(known,status)?status:'',search:params.get('search')??''},selected:type&&id?.trim()?{type,id}:null};
}
export function orderLocationHref({filters,selected}:OrderLocation){
 const params=new URLSearchParams();
 if(selected){params.set('type',selected.type);params.set('id',selected.id);if(filters.type!==selected.type)params.set('filter',filters.type);}
 else if(filters.type!=='ALL')params.set('type',filters.type);
 if(filters.status)params.set('status',filters.status);
 if(filters.search)params.set('search',filters.search);
 return `/orders${params.size?`?${params}`:''}`;
}
export function useOrderLocation(ownerId:string|null,resetForOwner:boolean,onNavigate:()=>void){
 const [location,setLocation]=useState(empty),[ready,setReady]=useState(false);
 useLayoutEffect(()=>{
  if(!ownerId)return;
  const read=()=>{onNavigate();setLocation(parseOrderLocation(window.location.search));};
  if(resetForOwner)window.history.replaceState(window.history.state,'','/orders');
  read();setReady(true);window.addEventListener('popstate',read);
  return()=>window.removeEventListener('popstate',read);
  // The page is keyed by owner. The callback only invalidates its editor ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ownerId]);
 function navigate(next:OrderLocation,replace=false){
  onNavigate();setLocation(next);
  const href=orderLocationHref(next);
  if(`${window.location.pathname}${window.location.search}`!==href)window.history[replace?'replaceState':'pushState'](window.history.state,'',href);
 }
 return{...location,ready,navigate};
}
