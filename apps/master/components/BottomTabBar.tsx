'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {useLocale,WrenchIcon, UserIcon } from '@masterqala/ui';
import {useCommercialMode} from '@/lib/commercial-mode';
import { useMasterPresence } from '@/lib/masterPresence';

const tabClass = (active: boolean) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${active ? 'text-primary' : 'text-ink-soft'}`;

export function BottomTabBar() {
  const{t}=useLocale();const{payoutsEnabled}=useCommercialMode();
  const pathname = usePathname();
  const { offer } = useMasterPresence();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-border bg-surface px-1 pb-1 pt-1.5 md:hidden">
      <a href="/" className={tabClass(pathname === '/')}>
        <WrenchIcon className="h-5 w-5" />
        {t('workHub')}
      </a>
      <a href="/?tab=planned" className={tabClass(false)}>
        <span className="text-lg leading-5">📅</span>
        {t('planned')}
      </a>
      <div className="flex flex-1 justify-center">
        <a
          href="/"
          className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-full text-xl text-white shadow-card ${
            offer ? 'bg-danger' : 'bg-primary'
          }`}
          aria-label={offer ? 'Открытый оффер' : 'Экран работы'}
        >
          {offer ? '⚡' : '🛠'}
        </a>
      </div>
      {payoutsEnabled&&<Link href="/wallet" className={tabClass(pathname === '/wallet')}>
        <span className="text-lg leading-5">💳</span>
        Кошелёк
      </Link>}
      <Link href="/become-master" className={tabClass(pathname === '/become-master')}>
        <UserIcon className="h-5 w-5" />
        {t('profile')}
      </Link>
    </nav>
  );
}
