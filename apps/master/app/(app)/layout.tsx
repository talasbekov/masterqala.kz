import { Sidebar } from '@/components/Sidebar';
import { AuthGuard } from '@/components/AuthGuard';
import { MasterPresenceProvider } from '@/lib/masterPresence';
import { OfferOverlay } from '@/components/OfferOverlay';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MasterPresenceProvider>
      {/* Ссылка видна только при фокусе — стиль .skip-link живёт в base.css. */}
      <a href="#main" className="skip-link">
        К основному содержимому
      </a>
      <div className="flex min-h-screen flex-col bg-background md:flex-row">
        <Sidebar />
        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
      <OfferOverlay />
    </MasterPresenceProvider>
  );
}
