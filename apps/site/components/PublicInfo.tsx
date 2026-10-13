'use client';
import {useLocale} from '@masterqala/ui';import {siteText} from '../lib/site-copy';import {publicText} from '../lib/public-content';import type {Category} from '../lib/categories';
export function RequestLink({appUrl}:{appUrl:string|null}) {const {language}=useLocale();return appUrl?<a className="mq-site-primary" href={appUrl+'/order/new'}>{siteText(language,'request')}</a>:<p role="status">{siteText(language,'unavailable')}</p>}
export function AboutView({appUrl}:{appUrl:string|null}) {
 const {language}=useLocale();return <main className="mq-site-info"><h1>{publicText(language,'aboutTitle')}</h1><section className="mq-site-card"><p>{publicText(language,'aboutBody')}</p></section>{(['terms','help'] as const).map(key=><section className="mq-site-card" key={key}><h2>{publicText(language,key==='terms'?'termsTitle':'helpTitle')}</h2><p className="mt-4">{publicText(language,key==='terms'?'termsBody':'helpBody')}</p></section>)}<div className="mt-8"><RequestLink appUrl={appUrl}/></div></main>;
}
export function FaqView() {
 const {language}=useLocale();const keys=['before','after','payment','availability','cancel','problem'] as const;return <main className="mq-site-info"><h1>{publicText(language,'faqTitle')}</h1>{keys.map(key=><details key={key} className="mq-site-card"><summary className="cursor-pointer font-semibold">{publicText(language,key)}</summary><p className="mt-4">{publicText(language,`${key}Body`)}</p></details>)}</main>;
}
export function MasterView({masterUrl}:{masterUrl:string|null}) {
 const {language}=useLocale();return <main className="mq-site-info"><h1>{publicText(language,'masterTitle')}</h1>{(['master','review','mode'] as const).map(key=><section className="mq-site-card" key={key}>{key!=='master'&&<h2>{publicText(language,key==='review'?'reviewTitle':'modeTitle')}</h2>}<p className={key==='master'?'':'mt-4'}>{publicText(language,key==='master'?'masterBody':key==='review'?'reviewBody':'modeBody')}</p></section>)}<div className="mt-8">{masterUrl?<a href={masterUrl+'/become-master'} className="mq-site-primary">{publicText(language,'openMaster')}</a>:<p role="status">{siteText(language,'unavailable')}</p>}</div></main>;
}
export function CategoryView({category,appUrl}:{category:Category;appUrl:string|null}) {
 const {language}=useLocale();return <main className="mq-site-info"><h1>{category.name}</h1><section className="mq-site-card"><h2>{publicText(language,'task')}</h2><p className="mt-4">{publicText(language,'categoryBody')}</p></section><div className="mt-8"><RequestLink appUrl={appUrl}/></div></main>;
}
