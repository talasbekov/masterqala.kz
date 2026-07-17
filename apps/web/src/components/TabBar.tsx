import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';
import { HomeIcon, ListIcon, UserIcon, WrenchIcon } from '@masterqala/ui';

export function useMasterActive(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    api('/masters/application')
      .then((p) => setActive(p?.status === 'ACTIVE'))
      .catch(() => setActive(false));
  }, []);
  return active;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold ${isActive ? 'text-primary' : 'text-muted'}`;

export default function TabBar() {
  const isMaster = useMasterActive();
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
      {isMaster && (
        <NavLink to="/work" className={tabClass}>
          <WrenchIcon className="h-5 w-5" />
          Работа
        </NavLink>
      )}
      <NavLink to="/profile" className={tabClass}>
        <UserIcon className="h-5 w-5" />
        Профиль
      </NavLink>
    </nav>
  );
}
