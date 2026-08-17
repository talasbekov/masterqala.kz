'use client';
import {
  Badge,
  Button,
  CoinsIcon,
  DocumentIcon,
  UserIcon,
  WalletIcon,
  WrenchIcon,
} from '@masterqala/ui';
import { NavLink } from './NavLink';
import { useMasterPresence } from '@/lib/masterPresence';

/*
 * Мобильный порядок первичен: мастер открывает кабинет с телефона на объекте.
 * До md — верхняя панель с горизонтальной прокруткой разделов и переключателем
 * «онлайн» под большим пальцем; от md — привычная боковая колонка 240px.
 */
export function Sidebar() {
  const { online, connected, geoDenied, goOnline, goOffline } = useMasterPresence();

  return (
    <aside className="flex flex-col border-b border-border bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3 md:block md:pb-2 md:pt-4">
        <span className="text-lg font-extrabold text-primary">MasterQala</span>
        <Badge tone={online ? 'success' : 'neutral'} className="ml-auto md:hidden">
          {online ? 'Онлайн' : 'Офлайн'}
        </Badge>
        {geoDenied && (
          <Badge tone="danger" className="md:hidden">
            Нет гео
          </Badge>
        )}
        <Button
          size="sm"
          variant={online ? 'secondary' : 'primary'}
          onClick={online ? goOffline : goOnline}
          className="md:hidden"
        >
          {online ? 'Выйти' : 'Стать онлайн'}
        </Button>
      </div>

      <nav
        aria-label="Разделы кабинета мастера"
        className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-x-visible md:px-3 md:pb-0"
      >
        <NavLink href="/" icon={<WrenchIcon />}>
          Работа
        </NavLink>
        <NavLink href="/become-master" icon={<DocumentIcon />}>
          Анкета
        </NavLink>
        <NavLink href="/lead-credits" icon={<CoinsIcon />}>
          Lead-кредиты
        </NavLink>
        <NavLink href="/wallet" icon={<WalletIcon />}>
          Кошелёк
        </NavLink>
        <a
          href="https://client.masterqala.kz"
          className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-bold text-ink-soft transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-fill-faint md:gap-3"
        >
          <UserIcon className="shrink-0" />
          Кабинет клиента
        </a>
      </nav>

      <div className="mt-auto hidden border-t border-border p-3 md:block">
        <div className="rounded-md bg-fill-soft px-3 py-2 text-xs">
          <div className="font-extrabold text-ink">{online ? 'Вы онлайн' : 'Вы офлайн'}</div>
          <div className="text-ink-soft">{connected ? 'Соединение активно' : 'Нет соединения'}</div>
          {geoDenied && <div className="mt-1 text-danger">Нет доступа к геолокации</div>}
        </div>
        <Button
          size="sm"
          fullWidth
          variant={online ? 'secondary' : 'primary'}
          onClick={online ? goOffline : goOnline}
          className="mt-2"
        >
          {online ? 'Выйти' : 'Стать онлайн'}
        </Button>
      </div>
    </aside>
  );
}
