'use client';
import { NavLink } from './NavLink';

export function Sidebar() {
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
      <div className="mt-auto border-t border-border pt-3">
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
