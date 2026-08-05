'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({
  href,
  icon,
  badge,
  children,
}: {
  href: string;
  icon: ReactNode;
  badge?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition-colors ${
        isActive ? 'bg-fill-soft text-primary' : 'text-ink-soft hover:bg-fill-faint'
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="flex-1">{children}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="rounded-pill bg-warning-ink px-2 py-0.5 text-[10px] font-extrabold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
