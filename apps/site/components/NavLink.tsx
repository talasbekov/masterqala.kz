'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/*
 * Отдельный клиентский компонент только ради usePathname: Header остаётся
 * серверным, потому что читает серверные переменные окружения (APP_URL).
 */
export function NavLink({ href, label, className }: { href: string; label: string; className?: string }) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`${className ?? ''} ${isActive ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'}`}
    >
      {label}
    </Link>
  );
}
