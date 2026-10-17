'use client';
import Link from 'next/link';
import {useLocale} from '@masterqala/ui';
import {desktopCopy} from '../desktop-order/copy';
import './client-workflow.css';
export function DesktopWorkspace({children,map=false}:{children:React.ReactNode;map?:boolean}){
 const {language,setLanguage}=useLocale(),c=desktopCopy[language];
 return <div className={`planned-workspace client-workflow${map?' client-workflow--map':''}`}><header className="planned-header"><Link href="/" className="desktop-brand">MasterQala</Link><nav><Link href="/order/new">{c.title}</Link><Link href="/orders">{c.orders}</Link><Link href="/profile">{c.profile}</Link><Link href="/support">{c.help}</Link></nav><span className="planned-city">Астана</span><div className="desktop-locales" aria-label="Language">{(['ru','kk','en'] as const).map(l=><button type="button" key={l} aria-pressed={l===language} onClick={()=>setLanguage(l)}>{l==='kk'?'KZ':l.toUpperCase()}</button>)}</div></header><main className="planned-workspace-main">{children}</main></div>;
}
