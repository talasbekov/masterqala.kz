import Link from 'next/link';
import { getAppUrl } from '@/lib/env';
import { NavLink } from './NavLink';

const NAV_LINKS = [
  { href: '/become-a-master', label: 'Стать мастером' },
  { href: '/about', label: 'О нас' },
  { href: '/faq', label: 'Вопросы' },
];

export function Header() {
  const appUrl = getAppUrl();

  return (
    <header className="relative border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-ink">
          MasterQala
        </Link>

        <nav aria-label="Основная навигация" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} className="text-sm" />
          ))}
          <a
            href={appUrl}
            className="inline-flex min-h-11 items-center rounded-pill bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-hover"
          >
            Войти
          </a>
        </nav>

        <details className="md:hidden">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-md px-2 text-sm font-semibold text-ink">
            Меню
          </summary>
          <nav
            aria-label="Мобильная навигация"
            className="absolute inset-x-0 top-full z-10 flex flex-col gap-4 border-b border-border bg-surface px-6 py-4"
          >
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} className="text-sm" />
            ))}
            <a
              href={appUrl}
              className="inline-flex min-h-11 items-center justify-center rounded-pill bg-primary px-5 text-center text-sm font-semibold text-on-primary"
            >
              Войти
            </a>
          </nav>
        </details>
      </div>
    </header>
  );
}
