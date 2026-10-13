'use client';
import { useTranslation } from 'react-i18next';
import { useLocale, LOCALE_COPY } from '@masterqala/ui';
import { useLanguageDialog } from './LanguageDialogController';

export function LanguageControl({ variant = 'default' }: { variant?: 'default' | 'header' | 'profile' }) {
  const { t } = useTranslation();
  const {language:locale}=useLocale();
  const open = useLanguageDialog();
  if (variant === 'profile') return <button type="button" className="mq-field mq-field--full mq-profile-language" aria-label={LOCALE_COPY[locale].title} aria-haspopup="dialog" onClick={open}>
    <span className="mq-field-label">{t('profile.languageLabel')}</span><span className="mq-profile-language-value">{({ ru: 'Русский', kk: 'Қазақша', en: 'English' })[locale]}</span>
  </button>;
  return <button type="button" className={variant === 'header' ? 'mq-client-locale' : 'min-h-11 rounded-md px-3 py-2 text-sm font-semibold text-ink'}
    aria-label={LOCALE_COPY[locale].title} aria-haspopup="dialog" onClick={open}>
    {variant === 'header' ? `${locale === 'kk' ? 'KZ' : locale.toUpperCase()} · ${locale === 'en' ? 'Astana' : 'Астана'}` : `${LOCALE_COPY[locale].title} · ${locale === 'kk' ? 'KZ' : locale.toUpperCase()}`}
  </button>;
}
