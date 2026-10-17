'use client';
import {usePathname} from 'next/navigation';
import {DesktopWorkspace} from '@/components/desktop-planned/DesktopWorkspace';
import {ClientShell} from '@/components/ClientShell';
import { AuthGuard } from '@/components/AuthGuard';
import {PilotWorkspace} from '@/components/desktop-service/PilotWorkspace';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname=usePathname();
  if(pathname==='/')return <main>{children}</main>;
  if(['/support','/notifications','/payments','/profile'].includes(pathname))return <PilotWorkspace><AuthGuard>{children}</AuthGuard></PilotWorkspace>;
  if(['/catalog','/addresses'].includes(pathname))return <ClientShell><AuthGuard>{children}</AuthGuard></ClientShell>;
  if(pathname.startsWith('/planned/')||['/orders','/profile','/addresses','/support','/notifications','/payments','/catalog','/dashboard','/order/new'].includes(pathname)||/^\/order\/[^/]+\/dispute$/.test(pathname))return <DesktopWorkspace><AuthGuard>{children}</AuthGuard></DesktopWorkspace>;
  const orderPage=pathname.startsWith('/order/');
  if(orderPage)return <div className="flex min-h-screen bg-background"><main className="min-w-0 flex-1 overflow-y-auto"><AuthGuard>{children}</AuthGuard></main></div>;
  return <ClientShell><AuthGuard>{children}</AuthGuard></ClientShell>;
}
