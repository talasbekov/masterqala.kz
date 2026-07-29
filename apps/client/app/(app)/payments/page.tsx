'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useCommercialMode } from '@/lib/commercial-mode';

export default function PaymentsPage() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useCommercialMode();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col gap-3 px-5 pb-3.5 pt-6">
      <div className="flex items-center gap-2.5">
        <Link href="/profile" className="text-xl text-primary">
          ←
        </Link>
        <span className="text-xl font-extrabold text-ink">{t('payments.title')}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="text-4xl">{paymentsEnabled ? '💳' : '🎁'}</div>
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
