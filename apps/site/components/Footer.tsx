'use client';
import Link from 'next/link';
import {useLocale} from '@masterqala/ui';
import {siteText} from '../lib/site-copy';
import {publicText} from '../lib/public-content';
import {editorialText as text} from '../lib/editorial-copy';
export function Footer({phone,email,landing=true,appUrl=null}:{phone:string|null;email:string|null;landing?:boolean;appUrl?:string|null}) {
 const {language}=useLocale();
 const contacts=<>{phone&&<p>{phone}</p>}{email&&<p>{email}</p>}</>;
 if(!landing)return <footer className="mq-site-footer-current"><div><Link href="/" className="mq-site-footer-brand">MasterQala</Link><p>{text(language,'footerNote')}</p>{contacts}</div></footer>;
 return <footer className="mq-site-footer-landing"><div className="mq-site-landing-container">
  <Link href="/" className="mq-site-footer-brand">MasterQala</Link>
  <nav className="mq-site-footer-columns" aria-label={siteText(language,'navigation')}>
   <div><h2>{text(language,'clients')}</h2><a href={appUrl?appUrl+'/':'/#services'}>{text(language,'urgentAction')}</a><a href={appUrl?appUrl+'/planned/new':'/#services'}>{text(language,'plannedAction')}</a></div>
   <div><h2>{text(language,'navMaster')}</h2><Link href="/become-a-master">{siteText(language,'master')}</Link><Link href="/about">{publicText(language,'how')}</Link></div>
   <div><h2>{text(language,'support')}</h2><Link href="/faq">{text(language,'supportLink')}</Link><Link href="/about">{text(language,'orderRules')}</Link>{contacts}{!phone&&!email&&<p>{siteText(language,'contactsUnavailable')}</p>}</div>
  </nav>
  <p className="mq-site-footer-locale">{text(language,'country')} · {language==='ru'?'Русский':language==='kk'?'Қазақша':'English'}</p>
  <p className="mq-site-footer-note">{text(language,'footerNote')}</p>
 </div></footer>;
}
