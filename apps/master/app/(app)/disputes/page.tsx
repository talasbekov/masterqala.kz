'use client';
import Link from 'next/link';
import {OwnedDisputesView} from '@masterqala/ui';
import {useAuth} from '../../../lib/auth';
import {useMasterDisputes} from '../../../lib/useMasterDisputes';
export default function DisputesListPage() {
  const {user}=useAuth();
  const state=useMasterDisputes(user?.id??null);
  return <OwnedDisputesView {...state} onRetry={()=>{void state.retry();}} renderLink={({href,children,className,ariaLabel})=><Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
