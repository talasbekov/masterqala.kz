import { NavLink } from 'react-router-dom';
import { HomeIcon, ListIcon, UserIcon } from '@masterqala/ui';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${isActive ? 'text-primary' : 'text-muted'}`;

export default function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface">
      <NavLink to="/" end className={tabClass}>
        <HomeIcon className="h-5 w-5" />
        Главная
      </NavLink>
      <NavLink to="/orders" className={tabClass}>
        <ListIcon className="h-5 w-5" />
        Заявки
      </NavLink>
      <NavLink to="/profile" className={tabClass}>
        <UserIcon className="h-5 w-5" />
        Профиль
      </NavLink>
    </nav>
  );
}
