'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WrenchIcon, UserIcon } from '@masterqala/ui';
import { useMasterPresence } from '@/lib/masterPresence';

const tabClass = (active: boolean) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${active ? 'text-primary' : 'text-ink-soft'}`;

export function BottomTabBar() {
  const pathname = usePathname();
  const { offer } = useMasterPresence();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-border bg-surface px-1 pb-1 pt-1.5 md:hidden">
      <Link href="/" className={tabClass(pathname === '/')}>
        <WrenchIcon className="h-5 w-5" />
        Работа
      </Link>
      <Link href="/?tab=planned" className={tabClass(false)}>
        <span className="text-lg leading-5">📅</span>
        Плановые
      </Link>
      <div className="flex flex-1 justify-center">
        <Link
          href="/"
          className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-full text-xl text-white shadow-card ${
            offer ? 'bg-danger' : 'bg-primary'
          }`}
          aria-label={offer ? 'Открытый оффер' : 'Экран работы'}
        >
          {offer ? '⚡' : '🛠'}
        </Link>
      </div>
      <Link href="/wallet" className={tabClass(pathname === '/wallet')}>
        <span className="text-lg leading-5">💳</span>
        Кошелёк
      </Link>
      <Link href="/become-master" className={tabClass(pathname === '/become-master')}>
        <UserIcon className="h-5 w-5" />
        Профиль
      </Link>
    </nav>
  );
}
