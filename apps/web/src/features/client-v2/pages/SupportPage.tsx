import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function SupportPage() {
  const { t } = useTranslation();
  const faq = [t('support.faq1'), t('support.faq2'), t('support.faq3'), t('support.faq4')];

  return (
    <div className="flex flex-col gap-2.5 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <Link to="/" className="text-xl text-primary">
          ←
        </Link>
        <span className="text-xl font-extrabold text-ink">{t('support.title')}</span>
      </div>
      <a
        href="tel:7666"
        className="flex items-center justify-between rounded-md bg-primary p-4 text-[14.5px] font-extrabold text-white"
      >
        {t('support.call')} <span>›</span>
      </a>
      <div className="mt-1 text-[13.5px] font-extrabold text-ink">{t('support.faqTitle')}</div>
      {faq.map((q) => (
        <div
          key={q}
          className="flex items-center justify-between rounded-md border border-border bg-surface px-3.5 py-3.5"
        >
          <span className="text-[13px] font-bold leading-snug text-ink">{q}</span>
          <span className="text-ink-soft">›</span>
        </div>
      ))}
    </div>
  );
}
