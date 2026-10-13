'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ClientNavigationView } from './ClientNavigationView';
import { LanguageControl } from './LanguageControl';

export function ClientShell({ children, showMobileNavigation = true }: { children: ReactNode; showMobileNavigation?: boolean }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  return <div className={`mq-client-shell${showMobileNavigation ? '' : ' mq-client-shell--auth'}`}>
    <ClientNavigationView showMobileNavigation={showMobileNavigation} pathname={pathname} labels={{ order: t('navigation.order'), orders: t('navigation.orders'),
      profile: t('navigation.profile'), home: t('navigation.home'), notifications: t('navigation.notifications'), navigation: t('navigation.label') }}
      renderLink={props => <Link {...props} />} languageControl={<LanguageControl variant="header" />} />
    <main className="mq-client-main">{children}</main>
  </div>;
}
