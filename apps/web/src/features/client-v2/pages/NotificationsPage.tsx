import {Link} from 'react-router-dom';
import {ServiceAvailabilityView} from '@masterqala/ui';
import {useAuth} from '../../../auth';
export default function NotificationsPage() {
  const {user} = useAuth();
  return <ServiceAvailabilityView kind="notifications" authenticated={!!user} renderLink={({href,children,className,ariaLabel}) => <Link to={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
