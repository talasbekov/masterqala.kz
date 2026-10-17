'use client';
import { LocaleProvider, type Locale } from '@masterqala/ui';
import { api } from '@/lib/api';
import { Suspense, useState, type ReactNode } from 'react';
import {createInstance} from 'i18next';
import {I18nextProvider,initReactI18next} from 'react-i18next';
import ru from '@/lib/locales/ru.json';
import kk from '@/lib/locales/kk.json';
import en from '@/lib/locales/en.json';
import { AuthProvider } from '@/lib/auth';
import { LanguageDialogProvider } from './LanguageDialogProvider';
import { CommercialModeProvider } from '@/lib/commercial-mode';

export function Providers({ children, initialLanguage }: { children: ReactNode; initialLanguage?:Locale }) {
  // Each SSR request and its first browser render must use the same cookie locale.
  // A module singleton or localStorage initializer can disagree before the bridge effect runs.
  const [translations]=useState(()=>{
    const instance=createInstance();
    void instance.use(initReactI18next).init({
      resources:{ru:{translation:ru},kk:{translation:kk},en:{translation:en}},
      lng:initialLanguage??'ru',fallbackLng:'ru',initAsync:false,
      interpolation:{escapeValue:false},
    });
    return instance;
  });
  return (
    <I18nextProvider i18n={translations}>
    <LocaleProvider initialLanguage={initialLanguage} onChange={language=>{let signedIn=false;try{signedIn=Boolean(localStorage.getItem('token'));}catch{}if(signedIn) void api('/users/me',{method:'PATCH',body:JSON.stringify({language})}).catch(()=>{});}}><CommercialModeProvider>
      <AuthProvider><Suspense fallback={<div role="status" className="p-6">…</div>}><LanguageDialogProvider>{children}</LanguageDialogProvider></Suspense></AuthProvider>
    </CommercialModeProvider></LocaleProvider></I18nextProvider>
  );
}
