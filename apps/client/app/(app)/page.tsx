'use client';
import Link from 'next/link';
import {ClientHomeView,useClientHome} from '@masterqala/ui';
import {api} from '../../lib/api';
import {useAuth} from '../../lib/auth';
import {getSocket} from '../../lib/socket';
function subscribeStatus(callback:()=>void) {const socket=getSocket();socket.on('order:status',callback);return()=>{socket.off('order:status',callback);};}
export default function HomePage() {
  const {user}=useAuth();
  const state=useClientHome({ownerId:user?.id??null,api,subscribeStatus});
  return <ClientHomeView {...state} displayName={user?.name} onRetry={()=>{void state.retry();}} renderLink={({href,children,className,ariaLabel})=><Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
