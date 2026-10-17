'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useLocale} from '@masterqala/ui';
import {useAuth} from '../lib/auth';
import {useMasterPresence} from '../lib/masterPresence';
import {masterSurfaceText} from '../lib/masterSurfaceCopy';
import {masterDesignCopy} from '../lib/masterDesignCopy';
import './remaining-routes.css';
export function MasterWorkspace({children,anonymous=false}:{children:React.ReactNode;anonymous?:boolean}){
 const {language,setLanguage}=useLocale(),c=masterDesignCopy(language),{user,logout}=useAuth(),path=usePathname()??'',router=useRouter();
 const presence=useMasterPresence();
 const sidebar=!anonymous&&!!user&&!['/wallet','/lead-credits','/become-master'].includes(path);
 const links=[['/',c.overview],['/history',c.orders],['/?tab=planned',c.planned],['/become-master',c.profile],['/become-master#master-documents',c.documents],['/disputes',c.disputes]];
 const signout=<button type="button" className="mq-master-signout" onClick={()=>{logout();router.replace('/login');}}>{c.logout}</button>;
 return <div className={`mq-master-workspace ${sidebar?'mq-master-workspace--sidebar':'mq-master-workspace--current'}`}>
  {sidebar&&<aside className="mq-master-sidebar"><Link href="/" className="mq-master-brand">MasterQala</Link><p>{c.workspace}</p><nav aria-label={c.workspace}>{links.map(([href,label])=><Link key={href} href={href} aria-current={path===href||href==='/disputes'&&path.startsWith('/disputes/')?'page':undefined}>{label}</Link>)}</nav>{signout}</aside>}
  <div className="mq-master-workspace__body"><header className="mq-master-header">
   {!sidebar&&<Link href="/" className="mq-master-brand" aria-label="MasterQala">MasterQala</Link>}
   <span className="mq-master-header__label">{c.workspace}</span>
   {sidebar&&<><span className="mq-master-header__status">{masterSurfaceText(language,presence.availabilityPending?'pendingLocation':presence.online?'requestedOn':'requestedOff')}</span><span className="mq-master-header__name">{user?.name}</span></>}
   <div className="mq-master-locales" aria-label={c.language}>{(['ru','kk','en'] as const).map(locale=><button type="button" key={locale} aria-pressed={language===locale} onClick={()=>setLanguage(locale)}>{locale==='kk'?'KZ':locale.toUpperCase()}</button>)}</div>
   {!sidebar&&!anonymous&&user&&signout}
  </header><main className="mq-master-workspace__main">{children}</main>
  {!sidebar&&!anonymous&&<footer className="mq-master-footer"><Link href="/">MasterQala</Link><p>{c.footer}</p></footer>}</div>
 </div>;
}
