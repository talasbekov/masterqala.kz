'use client';
import { useTranslation } from 'react-i18next';
import { BellIcon, CatalogIcon, HomeIcon, ListIcon, PlusIcon, UserIcon } from '@masterqala/ui';
import { NavLink } from './NavLink';

export function Sidebar() {
  const { t } = useTranslation();

  return (
    // Ниже md навигация — горизонтальная лента над контентом: фиксированные
    // w-60 сжимали страницу до нечитаемого на узком экране.
    <nav
      aria-label={t('nav.primary')}
      className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border bg-surface p-3 md:w-60 md:flex-col md:overflow-x-visible md:border-r md:border-b-0 md:p-4"
    >
      <div className="mb-4 hidden px-3 text-lg font-extrabold text-primary md:block">MasterQala</div>
      <NavLink href="/" icon={<HomeIcon size={20} />}>
        {t('tabs.home')}
      </NavLink>
      <NavLink href="/catalog" icon={<CatalogIcon size={20} />}>
        {t('catalog.title')}
      </NavLink>
      <NavLink href="/orders" icon={<ListIcon size={20} />}>
        {t('tabs.orders')}
      </NavLink>
      <NavLink href="/order/new" icon={<PlusIcon size={20} />}>
        {t('home.urgentButton')}
      </NavLink>
      <NavLink href="/notifications" icon={<BellIcon size={20} />}>
        {t('tabs.notifications')}
      </NavLink>
      <NavLink href="/profile" icon={<UserIcon size={20} />}>
        {t('tabs.profile')}
      </NavLink>
    </nav>
  );
}
