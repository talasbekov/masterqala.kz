'use client';
import {
  ChartIcon,
  ShieldIcon,
  UsersIcon,
  WrenchIcon,
  ListIcon,
  ScaleIcon,
  WalletIcon,
  JournalIcon,
  DocumentIcon,
  LogoutIcon,
} from '@masterqala/ui';
import { NavLink } from './NavLink';
import { useAuth } from '@/lib/auth';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

/*
 * Боковое меню.
 *
 * Ширина адаптивная: ниже lg (1024px) остаётся колонка иконок шириной 4rem,
 * иначе фиксированные 14rem вместе с таблицами и панелью деталей выдавливали
 * страницу за пределы окна.
 */
export function Sidebar() {
  const { logout } = useAuth();
  const { metrics } = useOperatorMetrics();

  return (
    <aside
      aria-label="Разделы панели оператора"
      className="flex w-16 shrink-0 flex-col gap-1 border-r border-border bg-surface p-2 lg:w-56 lg:p-3"
    >
      <div className="mb-3 px-2 text-base font-extrabold text-primary">
        <span className="lg:hidden" aria-hidden="true">
          MQ
        </span>
        <span className="hidden lg:inline">MasterQala · Оператор</span>
      </div>
      <nav className="flex flex-col gap-1">
        <NavLink href="/" icon={<ChartIcon />} label="Обзор" />
        <NavLink
          href="/verification"
          icon={<DocumentIcon />}
          label="Верификация"
          badge={metrics?.pendingVerificationCount}
        />
        <NavLink href="/users" icon={<UsersIcon />} label="Пользователи" />
        <NavLink href="/masters" icon={<WrenchIcon />} label="Мастера" />
        <NavLink
          href="/orders"
          icon={<ListIcon />}
          label="Заказы"
          badge={metrics?.stuckSearches.length}
        />
        <NavLink
          href="/disputes"
          icon={<ScaleIcon />}
          label="Споры"
          badge={metrics?.openDisputesCount}
        />
        <NavLink
          href="/withdrawals"
          icon={<WalletIcon />}
          label="Вывод средств"
          badge={metrics?.pendingWithdrawalsCount}
        />
        <NavLink href="/journal" icon={<JournalIcon />} label="Журнал" />
        <NavLink href="/security" icon={<ShieldIcon />} label="Безопасность" />
      </nav>
      <div className="mt-auto border-t border-border pt-3">
        <button
          type="button"
          onClick={logout}
          aria-label="Выйти"
          title="Выйти"
          className="flex min-h-11 w-full items-center justify-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-bold text-ink-soft transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-fill-faint lg:justify-start"
        >
          <span className="shrink-0" aria-hidden="true">
            <LogoutIcon />
          </span>
          <span className="hidden lg:block" aria-hidden="true">
            Выйти
          </span>
        </button>
      </div>
    </aside>
  );
}
