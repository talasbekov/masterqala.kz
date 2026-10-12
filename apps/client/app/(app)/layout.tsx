'use client';
import {usePathname} from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const orderPage=usePathname().startsWith('/order/');
  return (
    <div className="flex min-h-screen bg-background">
      {!orderPage&&<Sidebar />}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
