import {Link} from 'react-router-dom';
import {ServiceAvailabilityView} from '@masterqala/ui';
import {useAuth} from '../../../auth';
export default function SupportPage() {
  const {user} = useAuth();
  return <ServiceAvailabilityView kind="support" authenticated={!!user} renderLink={({href,children,className,ariaLabel}) => <Link to={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
