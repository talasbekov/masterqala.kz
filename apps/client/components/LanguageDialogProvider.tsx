'use client';
import type {ReactNode} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {LocaleI18nBridge} from './LocaleI18nBridge';
import { useLocale } from '@masterqala/ui';
import { LanguageDialogController } from './LanguageDialogController';

export function LanguageDialogProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const {language,setLanguage}=useLocale();
  const href = pathname + (search ? `?${search}` : '');
  return <LanguageDialogController href={href} router={router}
    locale={language} onSelect={setLanguage}>
    <LocaleI18nBridge>{children}</LocaleI18nBridge>
  </LanguageDialogController>;
}
