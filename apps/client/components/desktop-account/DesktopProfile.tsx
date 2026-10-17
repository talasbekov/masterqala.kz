'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useTranslation} from 'react-i18next';
import {AccountProfileView,useLocale} from '@masterqala/ui';
import {api} from '../../lib/api';
import {useAuth} from '../../lib/auth';
import {LanguageControl} from '../LanguageControl';
import {desktopProfileDraftStore} from './address-draft';
import {accountCopy} from './copy';
import {designCopy} from '../desktop-service/design-copy';
import './desktop-account.css';

const links=[['addresses','/addresses'],['payments','/payments'],['notifications','/notifications'],['support','/support']] as const;
function masterAccountUrl(){const configured=process.env.NEXT_PUBLIC_MASTER_APP_URL;if(!configured)return null;try{const url=new URL(configured);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}}
export function DesktopProfile(){
 const {t,i18n}=useTranslation(),{language}=useLocale(),{user,logout}=useAuth(),router=useRouter(),copy=accountCopy[language];
 const translate=(key:string)=>(copy as Record<string,string>)[key]??t(key);
 const masterUrl=masterAccountUrl(),design=designCopy[language];
 return <div className="desktop-account desktop-account-profile"><AccountProfileView ownerId={user?.id??null} phoneFallback={user?.phone} api={api} t={translate} draftStore={desktopProfileDraftStore} logoutPlacement="aside" languageControl={<LanguageControl variant="profile"/>}
  beforeHeading={<p className="desktop-service-status">{design.profileStatus}</p>}
  personalFooter={<nav className="desktop-account-primary-links"><Link href="/addresses">{t('profile.items.addresses')}</Link><Link href="/payments">{t('profile.items.payments')}</Link></nav>}
  onLogout={()=>{logout();router.push('/login');}} notice={me=>{const until=me.masterProfile?.blockedUntil,timestamp=until?Date.parse(until):NaN;return Number.isFinite(timestamp)&&timestamp>Date.now()?<div role="status" className="desktop-account-notice">{t('profile.blockedUntil',{date:new Date(timestamp).toLocaleDateString(i18n.language==='kk'?'kk-KZ':i18n.language==='en'?'en-GB':'ru-RU')})}</div>:null;}}>
   <section className="desktop-account-context-card"><h2>{design.addressesHeading}</h2><p>{design.addressesBody}</p></section>
   <section className="desktop-account-context-card"><h2>{design.methodsHeading}</h2><p>{design.methodsBody}</p></section>
   <details className="desktop-account-settings"><summary>{copy.settings}</summary>
   <nav aria-label={copy.settings} className="desktop-account-links">
    <Link href="/addresses">{t('profile.items.addresses')}</Link>
    <Link href="/orders?tab=history">{copy.history}</Link>
    {links.slice(1).map(([key,href])=><Link key={key} href={href}>{t(`profile.items.${key}`)}</Link>)}
   </nav>
   {masterUrl&&<section className="desktop-account-master"><h3>{copy.master}</h3><p>{copy.masterHint}</p><a href={masterUrl}>{copy.masterAction}</a></section>}
   </details>
  </AccountProfileView></div>;
}
