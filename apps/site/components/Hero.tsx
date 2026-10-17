'use client';
import {useLocale} from '@masterqala/ui';
import {editorialText as text} from '../lib/editorial-copy';
import {RequestLink} from './PublicInfo';
export function Hero({appUrl}:{appUrl:string|null}) {
 const {language}=useLocale();
 return <section className="mq-site-landing-hero"><div className="mq-site-landing-container mq-site-split">
  <div className="mq-site-hero-copy"><h1>{text(language,'heroTitle')}</h1><p>{text(language,'heroBody')}</p><RequestLink appUrl={appUrl} label={text(language,'find')}/></div>
  <img className="mq-site-photo mq-site-welcome-photo" src="/images/figma/welcome-home.png" width="640" height="580" alt="" fetchPriority="high"/>
 </div></section>;
}
