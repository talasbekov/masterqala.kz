'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, ChevronRightIcon, PhoneIcon } from '@masterqala/ui';

export default function SupportPage() {
  const { t } = useTranslation();
  const faq = [t('support.faq1'), t('support.faq2'), t('support.faq3'), t('support.faq4')];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-2.5 px-5 pt-6 pb-3.5 sm:px-8">
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          aria-label={t('common.back')}
          title={t('common.back')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-soft hover:bg-fill-soft"
        >
          <ArrowLeftIcon size={20} />
        </Link>
        <h1 className="text-xl font-extrabold text-ink">{t('support.title')}</h1>
      </div>
      <a
        href="tel:7666"
        className="flex min-h-11 items-center justify-between gap-2 rounded-md bg-primary p-4 text-sm font-extrabold text-on-primary transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-primary-hover"
      >
        <span className="flex items-center gap-2">
          <PhoneIcon size={18} />
          {t('support.call')}
        </span>
        <ChevronRightIcon size={18} />
      </a>
      <h2 className="mt-1 text-xs font-extrabold text-ink">{t('support.faqTitle')}</h2>
      <ul className="flex flex-col gap-2.5">
        {faq.map((q) => (
          <li
            key={q}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3.5 py-3.5"
          >
            <span className="text-xs leading-snug font-bold text-ink">{q}</span>
            <ChevronRightIcon size={18} className="shrink-0 text-ink-soft" />
          </li>
        ))}
      </ul>
    </div>
  );
}
