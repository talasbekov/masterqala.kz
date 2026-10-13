'use client';
import {useLocale} from '@masterqala/ui';
import {NavLink} from './NavLink';
import {useAuth} from '../lib/auth';
import {useOperatorMetrics} from '../lib/operatorMetrics';
import {operatorText,type OperatorCopyKey} from '../lib/operator-copy';
const links:[string,OperatorCopyKey][]=[['/','home'],['/orders','orders'],['/verification','verification'],['/disputes','disputes'],['/masters','masters'],['/users','users'],['/journal','journal'],['/security','security'],['/withdrawals','withdrawals']];
export function Sidebar() {
  const {logout}=useAuth(),{metrics}=useOperatorMetrics(),{language}=useLocale();
  const badge=(href:string)=>href==='/orders'?metrics?.stuckSearches.length:href==='/disputes'?metrics?.openDisputesCount:href==='/verification'?metrics?.pendingVerificationCount:href==='/withdrawals'?metrics?.pendingWithdrawalsCount:undefined;
  return <aside className="flex w-full shrink-0 flex-col gap-4 bg-primary px-4 py-7 text-white md:w-56"><div><p className="text-2xl font-semibold leading-[1.4]">MasterQala</p><p className="mt-2 text-xs">{operatorText(language,'operator')}</p></div><nav aria-label={operatorText(language,'navigation')} className="flex flex-wrap gap-2 md:flex-col">{links.map(([href,key])=><NavLink key={href} href={href} badge={badge(href)}>{operatorText(language,key)}</NavLink>)}</nav><button type="button" onClick={logout} className="mt-auto min-h-[48px] rounded-md px-3 py-3 text-left text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">{operatorText(language,'logout')}</button></aside>;
}
