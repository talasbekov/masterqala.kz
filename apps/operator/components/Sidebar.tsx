'use client';
import { NavLink } from './NavLink';
import { useAuth } from '@/lib/auth';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

export function Sidebar() {
  const { logout } = useAuth();
  const { metrics } = useOperatorMetrics();

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3">
      <div className="mb-3 px-2 text-base font-extrabold text-primary">MasterQala · Оператор</div>
      <NavLink href="/" icon="◫">
        Обзор
      </NavLink>
      <NavLink href="/verification" icon="🛡" badge={metrics?.pendingVerificationCount}>
        Верификация
      </NavLink>
      <NavLink href="/users" icon="👤">
        Пользователи
      </NavLink>
      <NavLink href="/masters" icon="🛠">
        Мастера
      </NavLink>
      <NavLink href="/orders" icon="☰" badge={metrics?.stuckSearches.length}>
        Заказы
      </NavLink>
      <NavLink href="/disputes" icon="⚖️" badge={metrics?.openDisputesCount}>
        Споры
      </NavLink>
      <NavLink href="/withdrawals" icon="₸" badge={metrics?.pendingWithdrawalsCount}>
        Вывод средств
      </NavLink>
      <NavLink href="/journal" icon="▤">
        Журнал
      </NavLink>
      <NavLink href="/security" icon="🔒">
        Безопасность
      </NavLink>
      <div className="mt-auto border-t border-border pt-3">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-bold text-ink-soft hover:bg-fill-faint"
        >
          <span className="text-lg">↩</span>
          Выйти
        </button>
      </div>
    </aside>
  );
}
