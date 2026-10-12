'use client';
import {usePathname} from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { BottomTabBar } from '@/components/BottomTabBar';
import { AuthGuard } from '@/components/AuthGuard';
import { MasterPresenceProvider } from '@/lib/masterPresence';
import { OfferOverlay } from '@/components/OfferOverlay';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const orderPage=usePathname().startsWith('/order/');
  return (
    <MasterPresenceProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className={`min-w-0 flex-1 overflow-y-auto ${orderPage?'pb-0':'pb-16 md:pb-0'}`}>
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
      {!orderPage&&<BottomTabBar />}
      <OfferOverlay />
    </MasterPresenceProvider>
  );
}
