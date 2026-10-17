'use client';
import Link from 'next/link';
import {useLocale} from '@masterqala/ui';
import type {Category} from '../lib/categories';
import {siteText} from '../lib/site-copy';
import {publicText} from '../lib/public-content';
import {editorialText as text} from '../lib/editorial-copy';
import {Hero} from './Hero';
import {CategoryTile} from './CategoryTile';
import {RequestLink} from './PublicInfo';
export function HomeView({categories,appUrl}:{categories:Category[];appUrl:string|null}) {
 const {language}=useLocale();
 return <main className="mq-site-landing">
  <Hero appUrl={appUrl}/>
  <section><div className="mq-site-landing-container mq-site-split mq-site-editorial-section">
   <img className="mq-site-photo mq-site-plumbing-photo" src="/images/figma/plumbing-service.png" width="640" height="496" alt="" loading="lazy"/>
   <div className="mq-site-editorial-copy"><span className="mq-site-section-label">{text(language,'urgentLabel')}</span><h2>{text(language,'urgentTitle')}</h2><p>{text(language,'urgentBody')}</p><RequestLink appUrl={appUrl} label={text(language,'urgentAction')} className="mq-site-text-link"/></div>
  </div></section>
  <section><div className="mq-site-landing-container mq-site-split mq-site-editorial-section">
   <div className="mq-site-editorial-copy"><span className="mq-site-section-label">{text(language,'plannedLabel')}</span><h2>{text(language,'plannedTitle')}</h2><p>{text(language,'plannedBody')}</p><RequestLink appUrl={appUrl} label={text(language,'plannedAction')} path='/planned/new' className="mq-site-text-link"/></div>
   <img className="mq-site-photo mq-site-cleaning-photo" src="/images/figma/cleaning-service.png" width="640" height="480" alt="" loading="lazy"/>
  </div></section>
  <section className="mq-site-master-invite"><div className="mq-site-landing-container mq-site-split mq-site-editorial-section">
   <div className="mq-site-editorial-copy"><span className="mq-site-section-label">{text(language,'masterLabel')}</span><h2>{text(language,'masterInvite')}</h2><p>{text(language,'masterInviteBody')}</p><Link className="mq-site-primary" href="/become-a-master">{siteText(language,'master')}</Link></div>
   <article className="mq-site-job-preview"><p className="mq-site-preview-label">{text(language,'previewLabel')}</p><h3>{text(language,'previewTitle')}</h3><p className="mq-site-preview-description">{text(language,'previewBody')}</p><p>{text(language,'previewPrice')}</p><Link className="mq-site-primary mq-site-primary-navy" href="/become-a-master">{text(language,'previewAction')}</Link></article>
  </div></section>
  <section id="services" className="mq-site-services mq-site-landing-container"><details><summary>{siteText(language,'categories')}</summary><p>{publicText(language,'task')}</p>{categories.length?<div className="mq-site-category-grid">{categories.map(category=><CategoryTile key={category.id} category={category}/>)}</div>:<p role="status">{siteText(language,'empty')}</p>}</details></section>
 </main>;
}
