'use client';
import { LocaleProvider, type Locale } from '@masterqala/ui';
import { api } from '@/lib/api';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';

export function Providers({ children, initialLanguage }: { children: ReactNode; initialLanguage?:Locale }) {
  return <LocaleProvider initialLanguage={initialLanguage} onChange={language=>{if(localStorage.getItem('token'))void api('/users/me',{method:'PATCH',body:JSON.stringify({language})}).catch(()=>{});}}><AuthProvider>{children}</AuthProvider></LocaleProvider>;
}
