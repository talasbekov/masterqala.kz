'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
export function NavLink({href,icon,badge,children}:{href:string;icon?:ReactNode;badge?:number;children:ReactNode}) {
  const pathname=usePathname(),active=pathname===href||(href!=='/'&&pathname.startsWith(href+'/'));
  return <Link href={href} aria-current={active?'page':undefined} className="operator-nav-link">{icon&&<span aria-hidden="true">{icon}</span>}<span className="min-w-0 flex-1 break-words">{children}</span>{typeof badge==='number'&&badge>0&&<span className="operator-nav-count">{badge}</span>}</Link>;
}
