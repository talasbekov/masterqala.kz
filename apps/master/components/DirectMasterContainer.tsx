"use client";
import {useCallback} from 'react';
import {useRouter} from 'next/navigation';
import {DirectMasterOrderView,useOrderState,useLocale,Button,type DirectOrder} from '@masterqala/ui';
import {api} from '@/lib/api';
import {getSocket} from '@/lib/socket';
const read=(id:string)=>api(`/orders/${id}`);
export function DirectMasterContainer({id}:{id:string}) {
 const router=useRouter();const{t}=useLocale();
 const subscribe=useCallback((refresh:()=>void)=>{const socket=getSocket();const changed=(payload:{orderId:string})=>{if(payload.orderId===id)refresh();};socket.on('order:status',changed);socket.on('connect',refresh);return()=>{socket.off('order:status',changed);socket.off('connect',refresh);};},[id]);
 const {order,loading,error,online,fresh,busy,load,mutate}=useOrderState<DirectOrder>({id,read,subscribe});
 if(loading)return <p className="p-6 text-ink-soft">{t('loading')}</p>;
 if(!order)return <div className="space-y-4 p-6"><p role="alert">{error}</p><Button onClick={()=>void load()}>{t('retry')}</Button></div>;
 return <DirectMasterOrderView order={order} busy={busy} error={error} online={online} fresh={fresh} onBack={()=>router.push('/')} onHelp={()=>router.push('/disputes')}
   onAction={(action,body)=>mutate(()=>api(`/orders/${id}/${action}`,{method:'POST',body:JSON.stringify(body??{})}))}/>;
}
