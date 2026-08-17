'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Alert, Button, CalendarIcon, InboxIcon, SearchIcon } from '@masterqala/ui';
import { api } from '@/lib/api';

export default function NoMastersView({
  orderId,
  freePilot,
  onChanged,
}: {
  orderId: string;
  freePilot: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState('');

  async function retry() {
    setError('');
    try {
      await api(`/orders/${orderId}/retry-search`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-3.5 px-6 text-center">
      <InboxIcon size={40} className="text-ink-muted" />
      <p className="text-xl font-extrabold text-ink">{t('orderDetail.noMastersTitle')}</p>
      <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
        {freePilot
          ? 'Сейчас рядом нет свободных мастеров. Списаний не было. Попробуйте поиск ещё раз или создайте плановую заявку — мастера сами предложат цену.'
          : t('orderDetail.noMastersText')}
      </p>
      {error && <Alert tone="danger" className="w-full text-left">{error}</Alert>}
      <Button variant="urgent" size="lg" fullWidth className="mt-2" icon={<SearchIcon size={18} />} onClick={retry}>
        {t('orderDetail.retrySearch')}
      </Button>
      <Button
        variant="secondary"
        fullWidth
        icon={<CalendarIcon size={18} />}
        onClick={() => router.push('/planned/new')}
      >
        {t('orderDetail.startPlanned')}
      </Button>
      <Button variant="ghost" onClick={() => router.push('/')}>
        {t('orderDetail.toHome')}
      </Button>
    </div>
  );
}
