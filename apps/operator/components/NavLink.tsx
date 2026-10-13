'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
export function NavLink({href,icon,badge,children}:{href:string;icon?:ReactNode;badge?:number;children:ReactNode}) {
  const pathname=usePathname(),active=pathname===href||(href!=='/'&&pathname.startsWith(href+'/'));
  return <Link href={href} aria-current={active?'page':undefined} className={`flex min-h-[48px] min-w-0 items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-white ${active?'bg-accent text-primary':'text-white hover:bg-white/10'}`}>{icon&&<span aria-hidden="true">{icon}</span>}<span className="min-w-0 flex-1 break-words">{children}</span>{typeof badge==='number'&&badge>0&&<span className={`rounded-md px-2 py-1 text-xs ${active?'bg-primary text-white':'bg-fill-soft text-primary'}`}>{badge}</span>}</Link>;
}
