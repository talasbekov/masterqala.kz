'use client';
import {useEffect,type ReactNode} from 'react';
import {useLocale} from '@masterqala/ui';
import {useTranslation} from 'react-i18next';
/** Canonical shared provider owns preference; legacy screens consume its translation bridge. */
export function LocaleI18nBridge({children}:{children:ReactNode}) {
  const {language}=useLocale();
  const {i18n}=useTranslation();
  useEffect(()=>{if(i18n.language!==language)void i18n.changeLanguage(language);},[language,i18n]);
  return <>{children}</>;
}
