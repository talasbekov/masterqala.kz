'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {OwnedOrdersView,useOwnedOrders,useLocale} from '@masterqala/ui';
import {clientWorkflowCopy} from '@/components/desktop-planned/design-copy';
import {useAuth} from '../../../lib/auth';
import {api} from '../../../lib/api';
export default function MyOrdersPage() {
  const {user} = useAuth();
  const {language}=useLocale(),c=clientWorkflowCopy[language];
  const [tab,setTab]=useState<'active'|'history'>('active');
  useEffect(()=>{const restore=()=>setTab(new URLSearchParams(window.location.search).get('tab')==='history'?'history':'active');restore();window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[]);
  function changeTab(value:'active'|'history'){setTab(value);const url=new URL(window.location.href);url.searchParams.set('tab',value);window.history.replaceState(window.history.state,'',url);}
  const state = useOwnedOrders({ownerId: user?.id ?? null, api});
  return <div className="client-owned-orders"><p className="client-orders-intro">{c.ordersIntro}</p><OwnedOrdersView selectedTab={tab} onTabChange={changeTab} key={user?.id ?? 'signed-out'} {...state} onRetry={() => {void state.retry();}} renderLink={({href,children,className,ariaLabel}) => <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/><aside className="planned-card client-orders-aside"><h2>{c.next}</h2><p>{c.nextNote}</p><Link className="client-workflow-action" href="/order/new">{c.now}</Link><Link className="urgent-secondary-link" href="/planned/new">{c.planned}</Link></aside></div>;
}
