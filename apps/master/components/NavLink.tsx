'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-bold transition-colors duration-(--duration-fast) ease-(--ease-out) md:gap-3 ${
        isActive ? 'bg-fill-soft text-primary' : 'text-ink-soft hover:bg-fill-faint'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      {children}
    </Link>
  );
}
