'use client';
import Link from 'next/link';
import {LOCALE_COPY,useLanguageDialog,useLocale} from '@masterqala/ui';
import {siteText} from '../lib/site-copy';
import {publicText} from '../lib/public-content';
import {editorialText as text} from '../lib/editorial-copy';
export function Header({appUrl,landing=true}:{appUrl:string|null;landing?:boolean}) {
 const {language,setLanguage}=useLocale(),open=useLanguageDialog();
 const links=<><Link href="/#services">{text(language,'services')}</Link><Link href="/about">{publicText(language,'how')}</Link><Link href="/become-a-master">{text(language,'navMaster')}</Link></>;
 return <header className={landing?'mq-site-header mq-site-header-landing':'mq-site-header mq-site-header-current'}>
  <div className="mq-site-header-inner">
   <Link href="/" className="mq-site-brand">MasterQala</Link>
   {landing?<nav className="mq-site-desktop-nav" aria-label={siteText(language,'navigation')}>{links}</nav>:<p className="mq-site-header-context">{text(language,'context')}</p>}
   {landing?<button type="button" className="mq-site-language" aria-haspopup="dialog" aria-label={LOCALE_COPY[language].title} onClick={open}>{text(language,'city')} · {language==='kk'?'KZ':language.toUpperCase()}</button>:
    <div className="mq-site-languages">{(['ru','kk','en'] as const).map(code=><button key={code} type="button" lang={code} aria-pressed={code===language} aria-haspopup={code===language?'dialog':undefined} aria-label={code===language?LOCALE_COPY[language].title:undefined} onClick={code===language?open:()=>setLanguage(code)}>{code==='kk'?'KZ':code.toUpperCase()}</button>)}</div>}
   {landing&&<details className="mq-site-mobile-menu"><summary>{siteText(language,'menu')}</summary><nav aria-label={siteText(language,'navigation')}>{links}<Link href="/faq">{text(language,'navFaq')}</Link>{appUrl&&<a href={appUrl+'/'}>{siteText(language,'login')}</a>}</nav></details>}
  </div>
 </header>;
}
