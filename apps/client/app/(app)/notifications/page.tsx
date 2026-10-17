'use client';
import Link from 'next/link';
import {ServiceAvailabilityView} from '@masterqala/ui';
import {useAuth} from '../../../lib/auth';
import {DesktopServiceView} from '../../../components/desktop-service/DesktopServiceView';
export default function NotificationsPage() {
  const {user} = useAuth();
  return <><div className="desktop-service-mobile"><ServiceAvailabilityView kind="notifications" authenticated={!!user} renderLink={({href,children,className,ariaLabel}) => <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/></div><DesktopServiceView kind="notifications" authenticated={!!user}/></>;
}
