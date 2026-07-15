import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api';

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
  `flex-1 py-3 text-center text-xs ${isActive ? 'text-teal-700 font-semibold' : 'text-gray-500'}`;

export default function TabBar() {
  const isMaster = useMasterActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-white">
      <NavLink to="/" end className={tabClass}>Главная</NavLink>
      <NavLink to="/orders" className={tabClass}>Мои заявки</NavLink>
      {isMaster && <NavLink to="/work" className={tabClass}>Работа</NavLink>}
      <NavLink to="/profile" className={tabClass}>Профиль</NavLink>
    </nav>
  );
}
