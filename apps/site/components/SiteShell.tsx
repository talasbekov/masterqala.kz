'use client';
import type {ReactNode} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {LanguageDialogController,LocaleProvider,useLocale,type Locale} from '@masterqala/ui';
import {Header} from './Header';import {Footer} from './Footer';
function Shell({children,appUrl,phone,email}:{children:ReactNode;appUrl:string|null;phone:string|null;email:string|null}) {
 const pathname=usePathname(),query=useSearchParams().toString(),router=useRouter(),{language,setLanguage}=useLocale();
 const href=pathname+(query?'?'+query:'')+(typeof window==='undefined'?'':window.location.hash);
 return <LanguageDialogController href={href} router={router} locale={language} onSelect={setLanguage}><Header appUrl={appUrl} landing={pathname==='/'}/><div className="flex-1">{children}</div><Footer phone={phone} email={email} appUrl={appUrl} landing={pathname==='/'}/></LanguageDialogController>;
}
export function SiteShell({initialLanguage,...props}:{initialLanguage:Locale;children:ReactNode;appUrl:string|null;phone:string|null;email:string|null}) {
 return <LocaleProvider initialLanguage={initialLanguage}><Shell {...props}/></LocaleProvider>;
}
