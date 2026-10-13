'use client';
import Link from 'next/link';import {useLocale} from '@masterqala/ui';import {publicText} from '../lib/public-content';import {siteText} from '../lib/site-copy';import {RequestLink} from './PublicInfo';
export function Hero({appUrl}:{appUrl:string|null}) {
 const {language}=useLocale();return <section className="bg-background"><div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-20 text-center md:py-28"><h1 className="text-4xl font-bold text-ink md:text-5xl">{publicText(language,'heroTitle')}</h1><p className="mx-auto max-w-2xl text-lg text-ink-soft">{publicText(language,'heroBody')}</p><div className="mx-auto flex flex-col gap-4 sm:flex-row"><RequestLink appUrl={appUrl}/><Link href="/become-a-master" className="inline-flex min-h-[52px] items-center justify-center rounded-md border border-primary px-8 py-3 font-semibold text-primary">{siteText(language,'master')}</Link></div></div></section>;
}
