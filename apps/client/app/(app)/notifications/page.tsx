'use client';
import Link from 'next/link';
import {ServiceAvailabilityView} from '@masterqala/ui';
import {useAuth} from '../../../lib/auth';
export default function NotificationsPage() {
  const {user} = useAuth();
  return <ServiceAvailabilityView kind="notifications" authenticated={!!user} renderLink={({href,children,className,ariaLabel}) => <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
