import { useTranslation } from 'react-i18next';
import { BellIcon, EmptyState } from '@masterqala/ui';

export default function NotificationsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <h1 className="text-xl font-extrabold text-ink">{t('notifications.title')}</h1>
      <EmptyState
        icon={<BellIcon size={32} />}
        title={t('notifications.emptyTitle')}
        subtitle={t('notifications.emptySubtitle')}
      />
    </div>
  );
}
