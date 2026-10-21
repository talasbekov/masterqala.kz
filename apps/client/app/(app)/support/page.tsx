'use client';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {ServiceAvailabilityView} from '@masterqala/ui';
import {useAuth} from '../../../lib/auth';
import {DesktopServiceView} from '../../../components/desktop-service/DesktopServiceView';
import {supportOrderId} from '../../../lib/order-support';
export default function SupportPage() {
  const {user} = useAuth();
  const orderId = supportOrderId(useSearchParams());
  return <><div className="desktop-service-mobile"><ServiceAvailabilityView kind="support" authenticated={!!user} orderId={orderId} renderLink={({href,children,className,ariaLabel}) => <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>}/></div><DesktopServiceView kind="support" authenticated={!!user} orderId={orderId}/></>;
}
