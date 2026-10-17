'use client';
import {useLocale} from '@masterqala/ui';
import {NavLink} from './NavLink';
import {useAuth} from '../lib/auth';
import {useOperatorMetrics} from '../lib/operatorMetrics';
import {operatorText,type OperatorCopyKey} from '../lib/operator-copy';
const links:[string,OperatorCopyKey][]=[['/','home'],['/orders','orders'],['/verification','verification'],['/disputes','disputes'],['/masters','masters'],['/users','users'],['/journal','journal'],['/security','security'],['/withdrawals','withdrawals']];
export function Sidebar() {
  const {logout}=useAuth(),{metrics}=useOperatorMetrics(),{language}=useLocale();
  const badge=(href:string)=>href==='/orders'?metrics?.stuckSearches.length:href==='/disputes'?metrics?.openDisputesCount:href==='/verification'?metrics?.pendingVerificationCount:undefined;
  return <aside className="operator-sidebar w-full md:w-56"><div className="operator-sidebar-brand"><a href="/">MasterQala</a><p>{operatorText(language,'operator')}</p></div><nav aria-label={operatorText(language,'navigation')}>{links.map(([href,key])=><NavLink key={href} href={href} badge={badge(href)}>{operatorText(language,key)}</NavLink>)}</nav><button type="button" onClick={logout} className="operator-logout">{operatorText(language,'logout')}</button></aside>;
}
