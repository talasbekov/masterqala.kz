'use client';
import { useTranslation } from 'react-i18next';
import { NavLink } from './NavLink';

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4">
      <div className="mb-4 px-3 text-lg font-extrabold text-primary">MasterQala</div>
      <NavLink href="/" icon="⌂">
        {t('tabs.home')}
      </NavLink>
      <NavLink href="/catalog" icon="🗂️">
        {t('catalog.title')}
      </NavLink>
      <NavLink href="/orders" icon="☰">
        {t('tabs.orders')}
      </NavLink>
      <NavLink href="/order/new" icon="＋">
        {t('home.urgentButton')}
      </NavLink>
      <NavLink href="/notifications" icon="🔔">
        {t('tabs.notifications')}
      </NavLink>
      <NavLink href="/profile" icon="◉">
        {t('tabs.profile')}
      </NavLink>
    </aside>
  );
}
