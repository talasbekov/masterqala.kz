import {Link} from 'react-router-dom';
import {ClientHomeView,useClientHome} from '@masterqala/ui';
import {api} from '../../../api';
import {useAuth} from '../../../auth';
import {getSocket} from '../../../socket';
function subscribeStatus(callback:()=>void) {const socket=getSocket();socket.on('order:status',callback);return()=>{socket.off('order:status',callback);};}
export default function HomePage() {
  const {user}=useAuth();
  const state=useClientHome({ownerId:user?.id??null,api,subscribeStatus});
  return <ClientHomeView {...state} displayName={user?.name} onRetry={()=>{void state.retry();}} renderLink={({href,children,className,ariaLabel})=><Link to={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
