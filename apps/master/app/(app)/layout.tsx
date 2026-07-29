import { Sidebar } from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';
import { MasterPresenceProvider } from '@/lib/masterPresence';
import { OfferOverlay } from '@/components/OfferOverlay';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MasterPresenceProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
      <OfferOverlay />
    </MasterPresenceProvider>
  );
}
