import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-extrabold ${
    isActive ? 'text-c2-primary' : 'text-c2-ink-soft'
  }`;

export default function BottomTabBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <nav className="flex items-end border-t border-c2-border bg-c2-surface px-1.5 pb-3.5 pt-1.5">
      <NavLink to="/" end className={tabClass}>
        <span className="text-[19px]">⌂</span>
        {t('tabs.home')}
      </NavLink>
      <NavLink to="/orders" className={tabClass}>
        <span className="text-[19px]">☰</span>
        {t('tabs.orders')}
      </NavLink>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => navigate('/order/new')}
          className="-mt-5.5 flex h-13 w-13 items-center justify-center rounded-full bg-c2-primary text-2xl text-white shadow-c2-card"
          aria-label={t('home.urgentButton')}
        >
          ＋
        </button>
      </div>
      <NavLink to="/notifications" className={tabClass}>
        <span className="text-[19px]">🔔</span>
        {t('tabs.notifications')}
      </NavLink>
      <NavLink to="/profile" className={tabClass}>
        <span className="text-[19px]">◉</span>
        {t('tabs.profile')}
      </NavLink>
    </nav>
  );
}
