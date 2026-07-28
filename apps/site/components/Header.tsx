import Link from 'next/link';
import { getAppUrl } from '@/lib/env';

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

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-ink-soft hover:text-ink">
              {link.label}
            </Link>
          ))}
          <a
            href={appUrl}
            className="rounded-pill bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Войти
          </a>
        </nav>

        <details className="md:hidden">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink">Меню</summary>
          <div className="absolute inset-x-0 top-full z-10 flex flex-col gap-4 border-b border-border bg-surface px-6 py-4">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-ink-soft">
                {link.label}
              </Link>
            ))}
            <a
              href={appUrl}
              className="rounded-pill bg-primary px-5 py-2 text-center text-sm font-semibold text-white"
            >
              Войти
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}
