'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, CardIcon, GiftIcon } from '@masterqala/ui';
import { useCommercialMode } from '@/lib/commercial-mode';

export default function PaymentsPage() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useCommercialMode();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-3 px-5 pt-6 pb-3.5 sm:px-8">
      <div className="flex items-center gap-2.5">
        <Link
          href="/profile"
          aria-label={t('common.back')}
          title={t('common.back')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-soft hover:bg-fill-soft"
        >
          <ArrowLeftIcon size={20} />
        </Link>
        <h1 className="text-xl font-extrabold text-ink">{t('payments.title')}</h1>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="text-primary" aria-hidden="true">
          {paymentsEnabled ? <CardIcon size={40} /> : <GiftIcon size={40} />}
        </span>
        <p className="text-base font-extrabold text-ink">
          {paymentsEnabled ? t('payments.comingSoon') : 'Бесплатный пилот'}
        </p>
        <p className="max-w-prose text-xs leading-relaxed text-ink-soft">
          {paymentsEnabled
            ? t('payments.note')
            : 'Платформа не списывает оплату за выезд и сервисный сбор. Стоимость работ согласуется с мастером после осмотра, расчёт происходит напрямую.'}
        </p>
      </div>
    </div>
  );
}
