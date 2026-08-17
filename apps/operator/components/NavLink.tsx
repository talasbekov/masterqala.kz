'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/*
 * Пункт бокового меню.
 *
 * Иконка приходит SVG-компонентом из @masterqala/ui: раньше здесь стояли эмодзи
 * (щит, человек, ключ, весы, замок), которые не наследуют цвет и озвучиваются
 * скринридером не тем, что значат.
 *
 * Ниже lg меню сжимается в колонку иконок, поэтому подпись прячется визуально —
 * доступное имя ссылке даёт aria-label, а счётчик входит в него текстом.
 */
export function NavLink({
  href,
  icon,
  label,
  badge,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
  const hasBadge = typeof badge === 'number' && badge > 0;

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      aria-label={hasBadge ? `${label}: ${badge}` : label}
      title={label}
      className={`relative flex min-h-11 items-center justify-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition-colors duration-(--duration-fast) ease-(--ease-out) lg:justify-start ${
        isActive ? 'bg-fill-soft text-primary' : 'text-ink-soft hover:bg-fill-faint'
      }`}
    >
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="hidden flex-1 lg:block" aria-hidden="true">
        {label}
      </span>
      {hasBadge && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 rounded-pill bg-warning-ink px-2 py-0.5 text-2xs font-extrabold text-on-warning lg:static"
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
