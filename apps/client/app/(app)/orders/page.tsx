'use client';
import Link from 'next/link';
import {OwnedOrdersView,useOwnedOrders} from '@masterqala/ui';
import {useAuth} from '../../../lib/auth';
import {api} from '../../../lib/api';
export default function MyOrdersPage() {
  const {user} = useAuth();
  const state = useOwnedOrders({ownerId: user?.id ?? null, api});
  return <OwnedOrdersView key={user?.id ?? 'signed-out'} {...state} onRetry={() => {void state.retry();}} renderLink={({href,children,className,ariaLabel}) => <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
