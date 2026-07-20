import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function PaymentsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <Link to="/profile" className="text-xl text-c2-primary">
          ←
        </Link>
        <span className="text-xl font-extrabold text-c2-ink">{t('payments.title')}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="text-4xl">💳</div>
        <div className="text-base font-extrabold text-c2-ink">{t('payments.comingSoon')}</div>
        <p className="max-w-[260px] text-xs leading-relaxed text-c2-ink-soft">{t('payments.note')}</p>
      </div>
    </div>
  );
}
