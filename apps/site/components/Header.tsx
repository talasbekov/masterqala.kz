'use client';
import Link from 'next/link';
import {LOCALE_COPY,useLanguageDialog,useLocale} from '@masterqala/ui';
import {siteText} from '../lib/site-copy';
export function Header({appUrl}:{appUrl:string|null}) {
  const {language}=useLocale(),open=useLanguageDialog();
  const links=[{href:'/become-a-master',key:'master'},{href:'/about',key:'about'},{href:'/faq',key:'faq'}] as const;
  const navigation=<>{links.map(link=><Link key={link.href} href={link.href} className="text-sm text-ink-soft hover:text-ink">{siteText(language,link.key)}</Link>)}{appUrl&&<a href={appUrl} className="mq-site-primary">{siteText(language,'login')}</a>}</>;
  return <header className="relative border-b border-border bg-surface"><div className="mx-auto flex min-h-[88px] max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
    <Link href="/" className="mr-auto text-lg font-semibold text-ink">MasterQala</Link>
    <nav aria-label={siteText(language,'navigation')} className="hidden items-center gap-6 md:flex">{navigation}</nav>
    <button type="button" aria-haspopup="dialog" aria-label={LOCALE_COPY[language].title} onClick={open} className="min-h-[44px] rounded-md bg-fill-soft px-4 font-semibold text-primary">{language==='kk'?'KZ':language.toUpperCase()}</button>
    <details className="md:hidden"><summary className="min-h-[44px] cursor-pointer list-none py-3 text-sm font-semibold">{siteText(language,'menu')}</summary><nav aria-label={siteText(language,'navigation')} className="absolute inset-x-0 top-full z-10 flex flex-col gap-4 border-b border-border bg-surface px-6 py-4">{navigation}</nav></details>
  </div></header>;
}
