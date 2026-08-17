import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, CardIcon, GiftIcon } from '@masterqala/ui';
import { useCommercialMode } from '../../../commercial-mode';

export default function PaymentsPage() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useCommercialMode();

  return (
    <div className="flex min-h-screen flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <Link
          to="/profile"
          aria-label={t('common.back')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-soft"
        >
          <ArrowLeftIcon />
        </Link>
        <h1 className="text-xl font-extrabold text-ink">{t('payments.title')}</h1>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="text-ink-muted">
          {paymentsEnabled ? <CardIcon size={40} /> : <GiftIcon size={40} />}
        </div>
        <div className="text-base font-extrabold text-ink">
          {paymentsEnabled ? t('payments.comingSoon') : 'Бесплатный пилот'}
        </div>
        <p className="max-w-[280px] text-xs leading-relaxed text-ink-soft">
          {paymentsEnabled
            ? t('payments.note')
            : 'Платформа не списывает оплату за выезд и сервисный сбор. Стоимость работ согласуется с мастером после осмотра, расчёт происходит напрямую.'}
        </p>
      </div>
    </div>
  );
}
