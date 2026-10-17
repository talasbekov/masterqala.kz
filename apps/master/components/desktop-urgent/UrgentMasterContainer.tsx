'use client';
import Link from 'next/link';
import {Button,useLocale} from '@masterqala/ui';
import {useAuth} from '@/lib/auth';
import {DirectMasterContainer} from '../DirectMasterContainer';
import {useUrgentMasterOrder} from './useUrgentMasterOrder';
import {UrgentMasterView} from './UrgentMasterView';
import {urgentCopy} from './copy';
import './urgent.css';
export function UrgentMasterContainer({id,onChanged}:{id:string;onChanged?:()=>void}) {
 const {user}=useAuth();
 return <OwnedUrgentOrder key={`${user?.id??'signed-out'}:${id}`} ownerId={user?.id??null} id={id} onChanged={onChanged}/>;
}
function OwnedUrgentOrder({ownerId,id,onChanged}:{ownerId:string|null;id:string;onChanged?:()=>void}) {
 const {language}=useLocale(),c=urgentCopy[language];
 const state=useUrgentMasterOrder({ownerId,id,onChanged});
 if(state.loading)return <main className="mq-urgent"><p role="status">{c.loading}</p></main>;
 if(!state.order)return <main className="mq-urgent"><section className="mq-urgent-card"><h1>{c.urgent}</h1><p role="alert">{state.unavailable||!ownerId?c.unavailable:!state.online?c.offline:c.readError}</p><Button disabled={!ownerId||!state.online} onClick={()=>void state.refresh()}>{c.refresh}</Button><Link href="/">{c.back}</Link></section></main>;
 if(state.order.lifecycleVersion>=2)return <DirectMasterContainer key={`${ownerId}:${id}:direct`} id={id}/>;
 return <UrgentMasterView key={`${ownerId}:${id}`} ownerId={ownerId!} order={state.order} busy={state.busy} fresh={state.fresh} online={state.online} error={state.error} onRefresh={state.refresh} onAction={state.mutate}/>;
}
