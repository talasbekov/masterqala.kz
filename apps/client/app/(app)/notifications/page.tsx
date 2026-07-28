'use client';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@masterqala/ui';

export default function NotificationsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3.5 px-8 py-6">
      <div className="text-[22px] font-extrabold text-ink">{t('notifications.title')}</div>
      <EmptyState
        icon={<span className="text-3xl">🔔</span>}
        title={t('notifications.emptyTitle')}
        subtitle={t('notifications.emptySubtitle')}
      />
    </div>
  );
}
