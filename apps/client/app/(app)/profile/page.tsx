'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useTranslation} from 'react-i18next';
import {AccountProfileView} from '@masterqala/ui';
import {api} from '../../../lib/api';
import {useAuth} from '../../../lib/auth';
import {LanguageControl} from '../../../components/LanguageControl';
const items=[['addresses','/addresses'],['payments','/payments'],['notifications','/notifications'],['support','/support']] as const;
export default function ProfilePage(){
 const {t,i18n}=useTranslation();const {user,logout}=useAuth();const router=useRouter();
 return <AccountProfileView ownerId={user?.id??null} phoneFallback={user?.phone} api={api} t={key=>t(key)} languageControl={<LanguageControl variant="profile"/>}
  onLogout={()=>{logout();router.push('/login');}} notice={me=>{
   const until=me.masterProfile?.blockedUntil;const timestamp=until?Date.parse(until):NaN;
   return Number.isFinite(timestamp)&&timestamp>Date.now()?<div className="rounded-md bg-danger-bg p-3 text-xs font-semibold text-danger-ink">{t('profile.blockedUntil',{date:new Date(timestamp).toLocaleDateString(i18n.language==='kk'?'kk-KZ':i18n.language==='en'?'en-GB':'ru-RU')})}</div>:null;
  }}>
  {items.map(([key,href])=><Link key={key} href={href} className="flex min-h-[52px] items-center justify-between rounded-md border border-border bg-surface px-4 py-3 text-primary">{t(`profile.items.${key}`)}<span aria-hidden>›</span></Link>)}
  <div className="rounded-lg bg-fill p-4"><strong>{t('profile.becomeMasterTitle')}</strong><p>{t('profile.becomeMasterSubtitle')}</p><Link href="/become-master">{t('profile.becomeMasterLink')}</Link></div>
  <Link href="/wallet">{t('profile.wallet')}</Link>{user?.role==='OPERATOR'&&<Link href="/admin">{t('profile.adminPanel')}</Link>}
 </AccountProfileView>;
}
