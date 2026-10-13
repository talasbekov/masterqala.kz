import {Link,useParams} from 'react-router-dom';
import {OrderDisputeView,useOrderDispute} from '@masterqala/ui';
import {useAuth} from '../../../auth';
import {api,apiUpload} from '../../../api';
import LegacyDisputePage from './LegacyDisputePage';
function UrgentDisputePage() {
  const {id=''}=useParams<{id:string}>();
  const {user}=useAuth();
  const controller=useOrderDispute({ownerId:user?.id??null,target:{kind:'orders',id},api,upload:apiUpload});
  return <OrderDisputeView controller={controller} role="client" orderHref={`/order/${encodeURIComponent(id)}`} listHref="/orders" confirmReply={()=>false} renderLink={({href,children,className,ariaLabel})=><Link to={href} className={className} aria-label={ariaLabel}>{children}</Link>}/>;
}
export default function DisputePage({kind}:{kind:'orders'|'planned-orders'}) {
  return kind==='planned-orders'?<LegacyDisputePage kind={kind}/>:<UrgentDisputePage/>;
}
