'use client';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {LanguageDialogController,LOCALE_COPY,useLanguageDialog,useLocale} from '@masterqala/ui';
import type {ReactNode} from 'react';
import {useAuth} from '../lib/auth';
import {operatorText} from '../lib/operator-copy';
import {Sidebar} from './Sidebar';
function Header() {
  const {user}=useAuth(),{language}=useLocale(),open=useLanguageDialog();
  return <header className="flex min-h-[100px] min-w-0 flex-wrap items-center gap-4 bg-surface px-6 py-4"><p className="mr-auto text-sm text-ink-soft">{operatorText(language,'center')}</p><span className="rounded-md bg-fill-soft px-4 py-2 text-xs text-primary">{operatorText(language,'access')}</span><span className="min-w-0 break-words text-sm font-semibold">{user?.name??user?.phone??operatorText(language,'account')}</span><button type="button" aria-haspopup="dialog" aria-label={LOCALE_COPY[language].title} onClick={open} className="min-h-[52px] rounded-md bg-fill-soft px-4 text-sm font-semibold text-primary">{language==='kk'?'KZ':language.toUpperCase()}</button></header>;
}
export function OperatorShell({children}:{children:ReactNode}) {
  const pathname=usePathname(),search=useSearchParams(),router=useRouter(),{language,setLanguage}=useLocale();
  const query=search.toString(),hash=typeof window==='undefined'?'':window.location.hash;
  const href=pathname+(query?'?'+query:'')+hash;
  return <LanguageDialogController href={href} router={router} locale={language} onSelect={setLanguage}><div data-operator-shell className="flex min-h-dvh min-w-0 flex-col bg-background md:flex-row"><Sidebar/><div className="flex min-w-0 flex-1 flex-col"><Header/><main className="min-w-0 flex-1">{children}</main></div></div></LanguageDialogController>;
}
