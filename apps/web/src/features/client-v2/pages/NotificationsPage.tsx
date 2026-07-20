import { useTranslation } from 'react-i18next';
import { EmptyState } from '@masterqala/ui';

export default function NotificationsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-[22px] font-extrabold text-c2-ink">{t('notifications.title')}</div>
      <EmptyState icon={<span className="text-3xl">🔔</span>} title={t('notifications.emptyTitle')} subtitle={t('notifications.emptySubtitle')} />
    </div>
  );
}
