'use client';
import Link from 'next/link';import {useLocale} from '@masterqala/ui';import {siteText} from '../lib/site-copy';
export function Footer({phone,email}:{phone:string|null;email:string|null}) {
 const {language}=useLocale();
 return <footer className="border-t border-border bg-surface"><div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 text-sm text-ink-soft md:flex-row md:items-center md:justify-between">
 <div><p className="font-semibold text-ink">MasterQala</p><p className="max-w-sm">{siteText(language,'tagline')}</p></div>
 <nav aria-label={siteText(language,'navigation')} className="flex flex-col gap-2">{(['about','faq','master'] as const).map(key=><Link key={key} href={key==='master'?'/become-a-master':'/'+key}>{siteText(language,key)}</Link>)}</nav>
 <div className="max-w-sm break-words">{phone&&<p>{phone}</p>}{email&&<p>{email}</p>}{!phone&&!email&&<p>{siteText(language,'contactsUnavailable')}</p>}</div>
 </div></footer>;
}
