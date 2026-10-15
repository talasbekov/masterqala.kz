import {Link} from 'react-router-dom';
import {OwnedOrdersView,useOwnedOrders} from '@masterqala/ui';
import {useAuth} from '../../../auth';
import {api} from '../../../api';
export default function MyOrdersPage() {
  const {user} = useAuth();
  const state = useOwnedOrders({ownerId: user?.id ?? null, api});
  return <OwnedOrdersView key={user?.id ?? 'signed-out'} {...state} onRetry={() => {void state.retry();}} renderLink={({href,children,className,ariaLabel}) => <Link to={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
