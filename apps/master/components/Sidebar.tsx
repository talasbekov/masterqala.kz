'use client';
import { useEffect, useState } from 'react';
import { NavLink } from './NavLink';
import { useMasterPresence } from '@/lib/masterPresence';
import { fetchMyDisputes } from '@/lib/disputes';

export function Sidebar() {
  const { online, connected, geoDenied, goOnline, goOffline } = useMasterPresence();
  const [openDisputes, setOpenDisputes] = useState(0);

  useEffect(() => {
    fetchMyDisputes()
      .then((disputes) => setOpenDisputes(disputes.filter((d) => d.status === 'OPEN').length))
      .catch(() => setOpenDisputes(0));
  }, []);

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface p-4">
      <div className="mb-4 px-3 text-lg font-extrabold text-primary">MasterQala</div>
      <NavLink href="/" icon="🛠">
        Работа
      </NavLink>
      <NavLink href="/become-master" icon="📋">
        Анкета
      </NavLink>
      <NavLink href="/lead-credits" icon="🎫">
        Lead-кредиты
      </NavLink>
      <NavLink href="/wallet" icon="💳">
        Кошелёк
      </NavLink>
      <NavLink href="/disputes" icon="⚖️" badge={openDisputes}>
        Мои споры
      </NavLink>
      <div className="mt-auto space-y-2 border-t border-border pt-3">
        <div className="rounded-md bg-fill-soft px-3 py-2 text-xs">
          <div className="font-extrabold text-ink">{online ? 'Вы онлайн' : 'Вы офлайн'}</div>
          <div className="text-ink-soft">{connected ? 'Соединение активно' : 'Нет соединения'}</div>
          {geoDenied && <div className="mt-1 text-danger">Нет доступа к геолокации</div>}
        </div>
        <button
          type="button"
          onClick={online ? goOffline : goOnline}
          className={`w-full rounded-pill px-3 py-2 text-xs font-extrabold text-white ${
            online ? 'bg-ink-soft' : 'bg-primary'
          }`}
        >
          {online ? 'Выйти' : 'Стать онлайн'}
        </button>
        <a
          href="https://client.masterqala.kz"
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold text-ink-soft hover:bg-fill-faint"
        >
          <span className="text-lg">↗</span>
          Личный кабинет клиента
        </a>
      </div>
    </aside>
  );
}
