'use client';
import { LocaleProvider, type Locale } from '@masterqala/ui';
import { api } from '@/lib/api';
import { Suspense, type ReactNode } from 'react';
import '@/lib/i18n';
import { AuthProvider } from '@/lib/auth';
import { LanguageDialogProvider } from './LanguageDialogProvider';
import { CommercialModeProvider } from '@/lib/commercial-mode';

export function Providers({ children, initialLanguage }: { children: ReactNode; initialLanguage?:Locale }) {
  return (
    <LocaleProvider initialLanguage={initialLanguage} onChange={language=>{let signedIn=false;try{signedIn=Boolean(localStorage.getItem('token'));}catch{}if(signedIn) void api('/users/me',{method:'PATCH',body:JSON.stringify({language})}).catch(()=>{});}}><CommercialModeProvider>
      <AuthProvider><Suspense fallback={<div role="status" className="p-6">…</div>}><LanguageDialogProvider>{children}</LanguageDialogProvider></Suspense></AuthProvider>
    </CommercialModeProvider></LocaleProvider>
  );
}
