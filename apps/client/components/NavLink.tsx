'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@masterqala/ui';

export function NavLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-bold whitespace-nowrap',
        'transition-colors duration-(--duration-fast) ease-(--ease-out)',
        isActive ? 'bg-fill-soft text-primary' : 'text-ink-soft hover:bg-fill-faint',
      )}
    >
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      {children}
    </Link>
  );
}
