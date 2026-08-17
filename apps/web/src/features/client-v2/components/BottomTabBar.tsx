import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BellIcon, HomeIcon, IconButton, ListIcon, PlusIcon, UserIcon } from '@masterqala/ui';

/*
 * min-h-11 — 44px, минимальная цель нажатия. Раньше вкладка была py-1.5 вокруг
 * глифа 19px, то есть примерно 34px по высоте.
 */
const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-2xs font-extrabold ${
    isActive ? 'text-primary' : 'text-ink-soft'
  }`;

export default function BottomTabBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <nav className="flex items-end border-t border-border bg-surface px-1.5 pb-3.5 pt-1.5">
      <NavLink to="/" end className={tabClass}>
        <HomeIcon size={22} />
        {t('tabs.home')}
      </NavLink>
      <NavLink to="/orders" className={tabClass}>
        <ListIcon size={22} />
        {t('tabs.orders')}
      </NavLink>
      <div className="flex flex-1 justify-center">
        <IconButton
          variant="primary"
          label={t('home.urgentButton')}
          icon={<PlusIcon size={24} />}
          onClick={() => navigate('/order/new')}
          className="-mt-5 shadow-card"
        />
      </div>
      <NavLink to="/notifications" className={tabClass}>
        <BellIcon size={22} />
        {t('tabs.notifications')}
      </NavLink>
      <NavLink to="/profile" className={tabClass}>
        <UserIcon size={22} />
        {t('tabs.profile')}
      </NavLink>
    </nav>
  );
}
