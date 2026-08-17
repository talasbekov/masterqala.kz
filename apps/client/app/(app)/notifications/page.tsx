'use client';
import { useTranslation } from 'react-i18next';
import { BellIcon, EmptyState } from '@masterqala/ui';

export default function NotificationsPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3.5 px-5 py-6 sm:px-8">
      <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{t('notifications.title')}</h1>
      <EmptyState
        icon={<BellIcon size={32} />}
        title={t('notifications.emptyTitle')}
        subtitle={t('notifications.emptySubtitle')}
      />
    </div>
  );
}
