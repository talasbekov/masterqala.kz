'use client';
import type {ReactNode} from 'react';
import Link from 'next/link';
import {useLocale} from '@masterqala/ui';
import {siteText} from '../lib/site-copy';
import {publicText} from '../lib/public-content';
import {editorialText as text} from '../lib/editorial-copy';
import type {Category} from '../lib/categories';
export function RequestLink({appUrl,label,path='/',className='mq-site-primary'}:{appUrl:string|null;label?:string;path?:'/'|'/planned/new'|'/support';className?:string}) {
 const {language}=useLocale();
 return appUrl?<a className={className} href={appUrl+path}>{label??siteText(language,'request')}{className==='mq-site-text-link'&&<span aria-hidden="true"> ⟶</span>}</a>:<p role="status" className="mq-site-unavailable">{siteText(language,'unavailable')}</p>;
}
export function PublicNavigation({active}:{active:'about'|'faq'|'master'|'category'}) {
 const {language}=useLocale();
 const links=[['about','/about','navAbout'],['faq','/faq','navFaq'],['master','/become-a-master','navMaster'],['category','/categories/plumbing','plumbing']] as const;
 return <nav className="mq-site-page-navigation" aria-label={siteText(language,'navigation')}>{links.map(([key,href,label])=><Link key={key} href={href} aria-current={key===active?'page':undefined}>{text(language,label)}</Link>)}</nav>;
}
function EditorialHero({title,body,image,children}:{title:string;body:string;image?:string;children:ReactNode}) {
 return <section className={'mq-site-page-hero'+(image?'':' mq-site-page-hero-text')}><div className="mq-site-page-hero-copy"><h1>{title}</h1><p>{body}</p>{children}</div>{image&&<img className="mq-site-photo mq-site-page-photo" src={image} width="600" height="440" alt="" fetchPriority="high"/>}</section>;
}
function InformationCards({kind}:{kind:'about'|'master'|'category'}) {
 const {language}=useLocale();
 return <><h2>{text(language,`${kind}Section`)}</h2><div className="mq-site-info-grid">{([1,2,3] as const).map(number=><section className="mq-site-card" key={number}><h3>{text(language,`${kind}${number}`)}</h3><p>{text(language,`${kind}${number}Body`)}</p></section>)}</div></>;
}
export function AboutView({appUrl}:{appUrl:string|null}) {
 const {language}=useLocale();
 return <main className="mq-site-info" aria-label={publicText(language,'aboutTitle')}><PublicNavigation active="about"/><EditorialHero title={text(language,'aboutTitle')} body={text(language,'aboutBody')} image="/images/figma/welcome-home.png"><RequestLink appUrl={appUrl} label={text(language,'find')} className="mq-site-primary mq-site-primary-navy"/></EditorialHero><InformationCards kind="about"/></main>;
}
export function FaqView({appUrl=null}:{appUrl?:string|null}) {
 const {language}=useLocale();
 return <main className="mq-site-info mq-site-faq" aria-label={publicText(language,'faqTitle')}><PublicNavigation active="faq"/><EditorialHero title={text(language,'faqTitle')} body={text(language,'faqBody')}><RequestLink appUrl={appUrl} label={text(language,'help')} path='/support' className="mq-site-primary mq-site-primary-navy"/></EditorialHero><h2>{text(language,'faqSection')}</h2><div className="mq-site-faq-list">{([1,2,3,4] as const).map(number=><section key={number} className="mq-site-card" aria-label={number===1?publicText(language,'before'):undefined}><h3>{text(language,`faq${number}`)}</h3><p>{text(language,`faq${number}Body`)}</p></section>)}</div></main>;
}
export function MasterView({masterUrl}:{masterUrl:string|null}) {
 const {language}=useLocale();
 return <main className="mq-site-info" aria-label={publicText(language,'masterTitle')}><PublicNavigation active="master"/><EditorialHero title={text(language,'masterTitle')} body={text(language,'masterBody')} image="/images/figma/plumbing-service.png">{masterUrl?<a href={masterUrl+'/become-master'} className="mq-site-primary mq-site-primary-navy">{text(language,'previewAction')}</a>:<p role="status" className="mq-site-unavailable">{siteText(language,'unavailable')}</p>}</EditorialHero><InformationCards kind="master"/></main>;
}
export function CategoryView({category,appUrl}:{category:Category;appUrl:string|null}) {
 const {language}=useLocale(),plumbing=category.slug==='plumbing';
 return <main className="mq-site-info"><PublicNavigation active="category"/><EditorialHero title={category.name+'.\n'+text(language,'categoryTitle')} body={plumbing?text(language,'categoryBody'):publicText(language,'categoryBody')} image={plumbing?'/images/figma/plumbing-service.png':undefined}><RequestLink appUrl={appUrl} label={publicText(language,'task')} className="mq-site-primary mq-site-primary-navy"/></EditorialHero><InformationCards kind="category"/></main>;
}
