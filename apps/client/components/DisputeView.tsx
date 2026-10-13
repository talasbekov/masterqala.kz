'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {OrderDisputeView,useOrderDispute} from '@masterqala/ui';
import {useAuth} from '../lib/auth';
import {api,apiUpload} from '../lib/api';
import LegacyDisputeView from './LegacyDisputeView';
function UrgentDisputeView() {
  const {id}=useParams<{id:string}>();
  const {user}=useAuth();
  const controller=useOrderDispute({ownerId:user?.id??null,target:{kind:'orders',id},api,upload:apiUpload});
  return <OrderDisputeView controller={controller} role="client" orderHref={`/order/${encodeURIComponent(id)}`} listHref="/orders" confirmReply={()=>false} renderLink={({href,children,className,ariaLabel})=><Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
export default function DisputeView({kind}:{kind:'orders'|'planned-orders'}) {
  return kind==='planned-orders'?<LegacyDisputeView kind={kind}/>:<UrgentDisputeView/>;
}
