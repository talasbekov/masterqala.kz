'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
export interface ClientHomeCategory {id:string;slug:string;name:string}
export interface ClientHomeOrder {id:string;status:string;category:{name:string}|null;lifecycleVersion?:number;commercialMode?:string}
interface HomeState {owner:string|null;order:ClientHomeOrder|null;categories:ClientHomeCategory[];orderLoading:boolean;categoriesLoading:boolean;orderError:string;categoriesError:string}
const empty=(owner:string|null):HomeState=>({owner,order:null,categories:[],orderLoading:!!owner,categoriesLoading:!!owner,orderError:'',categoriesError:''});
function parseOrder(value:unknown):ClientHomeOrder|null {
  if (!value || typeof value!=='object' || !('order' in value)) throw new Error('Invalid active order response');
  const order=(value as {order:unknown}).order;
  if (order===null) return null;
  if (!order || typeof order!=='object' || typeof (order as ClientHomeOrder).id!=='string' || !(order as ClientHomeOrder).id || typeof (order as ClientHomeOrder).status!=='string') throw new Error('Invalid active order response');
  const category=(order as ClientHomeOrder).category;
  if (category!==null && (typeof category!=='object' || typeof category?.name!=='string')) throw new Error('Invalid active order category');
  return order as ClientHomeOrder;
}
function parseCategories(value:unknown):ClientHomeCategory[] {
  if (!Array.isArray(value) || value.some(item=>!item || typeof item!=='object' || typeof item.id!=='string' || !item.id || typeof item.slug!=='string' || typeof item.name!=='string')) throw new Error('Invalid categories response');
  return value;
}
export function useClientHome({ownerId,api,subscribeStatus}:{ownerId:string|null;api:(path:string)=>Promise<unknown>;subscribeStatus:(callback:()=>void)=>()=>void}) {
  const [state,setState]=useState<HomeState>(()=>empty(ownerId));
  const ownership=useMemo(()=>({ownerId}),[ownerId]);
  const currentOwner=useRef(ownership),generation=useRef(0),mounted=useRef(false);
  useLayoutEffect(()=>{mounted.current=true;currentOwner.current=ownership;generation.current++;setState(empty(ownerId));return()=>{mounted.current=false;generation.current++;};},[ownership,ownerId]);
  const retry=useCallback(async()=>{
    if (!ownerId || !mounted.current || currentOwner.current!==ownership) return;
    const request=++generation.current;
    const valid=()=>mounted.current && currentOwner.current===ownership && generation.current===request;
    setState(previous=>({... (previous.owner===ownerId?previous:empty(ownerId)),orderLoading:true,categoriesLoading:true}));
    await Promise.all((['order','categories'] as const).map(async source=>{
      try {
        const value=await api(source==='order'?'/orders/active':'/categories');
        const parsed=source==='order'?parseOrder(value):parseCategories(value);
        if (!valid()) return;
        setState(previous=>source==='order'?{...previous,order:parsed as ClientHomeOrder|null,orderLoading:false,orderError:''}:{...previous,categories:parsed as ClientHomeCategory[],categoriesLoading:false,categoriesError:''});
      } catch(error) {
        if (!valid()) return;
        const message=error instanceof Error?error.message:'Home read failed';
        setState(previous=>source==='order'?{...previous,orderLoading:false,orderError:message}:{...previous,categoriesLoading:false,categoriesError:message});
      }
    }));
  },[ownerId,ownership,api]);
  useEffect(()=>{
    if (!ownerId) return;
    void retry();
    const unsubscribe=subscribeStatus(()=>{void retry();});
    return()=>{unsubscribe();generation.current++;};
  },[ownerId,retry,subscribeStatus]);
  const visible=state.owner===ownerId?state:empty(ownerId);
  return {order:visible.order,categories:visible.categories,orderLoading:visible.orderLoading,categoriesLoading:visible.categoriesLoading,orderError:visible.orderError,categoriesError:visible.categoriesError,retry};
}
