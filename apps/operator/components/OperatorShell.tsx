'use client';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {LanguageDialogController,LOCALE_COPY,useLanguageDialog,useLocale} from '@masterqala/ui';
import type {ReactNode} from 'react';
import {useAuth} from '../lib/auth';
import {operatorText} from '../lib/operator-copy';
import {Sidebar} from './Sidebar';
import {operatorFinanceCopy} from '../lib/operator-finance-copy';
function Header() {
  const {user}=useAuth(),{language}=useLocale(),open=useLanguageDialog();
  return <header className="operator-topbar"><p className="operator-topbar-context">{operatorText(language,'center')}</p><span className="operator-access">{operatorText(language,'access')}</span><span className="operator-identity">{user?.name??user?.phone??operatorText(language,'account')}</span><button type="button" aria-haspopup="dialog" aria-label={LOCALE_COPY[language].title} onClick={open} className="operator-locale-entry">{language==='kk'?'KZ':language.toUpperCase()}</button></header>;
}
export function OperatorShell({children}:{children:ReactNode}) {
  const pathname=usePathname(),search=useSearchParams(),router=useRouter(),{language,setLanguage}=useLocale();
  const query=search.toString(),hash=typeof window==='undefined'?'':window.location.hash;
  const href=pathname+(query?'?'+query:'')+hash;
  const finance=pathname==='/withdrawals',copy=operatorFinanceCopy[language];
  return <LanguageDialogController href={href} router={router} locale={language} onSelect={setLanguage}>{finance?<div data-operator-shell data-operator-finance-shell className="operator-finance-shell"><header className="operator-finance-header"><a href="/" className="operator-finance-brand">MasterQala</a><p>{copy.workspace}</p><div className="operator-finance-locales" aria-label={LOCALE_COPY[language].title}>{(['ru','kk','en'] as const).map(locale=><button key={locale} type="button" lang={locale} aria-pressed={language===locale} onClick={()=>setLanguage(locale)}>{locale==='kk'?'KZ':locale.toUpperCase()}</button>)}</div></header><main className="operator-finance-main">{children}</main><footer className="operator-finance-footer"><strong>MasterQala</strong><p>{copy.footer}</p></footer></div>:<div data-operator-shell className="operator-shell"><Sidebar/><div className="operator-workspace"><Header/><main className="operator-main">{children}</main></div></div>}</LanguageDialogController>;
}
