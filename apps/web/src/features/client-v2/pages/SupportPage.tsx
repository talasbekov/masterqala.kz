import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, Card, ChevronRightIcon, PhoneIcon } from '@masterqala/ui';

export default function SupportPage() {
  const { t } = useTranslation();
  const faq = [t('support.faq1'), t('support.faq2'), t('support.faq3'), t('support.faq4')];

  return (
    <div className="flex flex-col gap-2.5 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <Link
          to="/"
          aria-label={t('common.back')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-soft"
        >
          <ArrowLeftIcon />
        </Link>
        <h1 className="text-xl font-extrabold text-ink">{t('support.title')}</h1>
      </div>
      <a
        href="tel:7666"
        className="flex min-h-11 items-center justify-between gap-2 rounded-md bg-primary p-4 text-sm font-extrabold text-on-primary"
      >
        <span className="inline-flex items-center gap-2">
          <PhoneIcon size={18} />
          {t('support.call')}
        </span>
        <ChevronRightIcon size={18} />
      </a>
      <div className="mt-1 text-sm font-extrabold text-ink">{t('support.faqTitle')}</div>
      {faq.map((q) => (
        <Card key={q} padding="none">
          <div className="flex min-h-11 items-center justify-between gap-2 px-3.5 py-3.5">
            <span className="text-xs font-bold leading-snug text-ink">{q}</span>
            <ChevronRightIcon size={18} className="shrink-0 text-ink-soft" />
          </div>
        </Card>
      ))}
    </div>
  );
}
