'use client';
import Link from 'next/link';
import {useLocale} from '@masterqala/ui';
import {designCopy} from './design-copy';
import './desktop-service.css';

/** Native desktop shell from Figma 621:176 / 621:189. */
export function PilotWorkspace({children}:{children:React.ReactNode}) {
 const {language,setLanguage}=useLocale(),copy=designCopy[language];
 return <div className="client-pilot-workspace">
  <header className="client-pilot-header"><Link href="/" className="client-pilot-brand">MasterQala</Link><p>{copy.context}</p><div className="client-pilot-locales" aria-label="Language">{(['ru','kk','en'] as const).map(locale=><button type="button" key={locale} aria-pressed={language===locale} onClick={()=>setLanguage(locale)}>{locale==='kk'?'KZ':locale.toUpperCase()}</button>)}</div></header>
  <main className="client-pilot-main">{children}</main>
  <footer className="client-pilot-footer"><Link href="/">MasterQala</Link><p>{copy.footer}</p></footer>
 </div>;
}
