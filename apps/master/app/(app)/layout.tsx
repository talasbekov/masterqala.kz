'use client';
import { MasterWorkspace } from '@/components/MasterWorkspace';
import { AuthGuard } from '@/components/AuthGuard';
import { MasterPresenceProvider } from '@/lib/masterPresence';
import { OfferOverlay } from '@/components/OfferOverlay';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MasterPresenceProvider>
      <MasterWorkspace><AuthGuard>{children}</AuthGuard></MasterWorkspace>
      <OfferOverlay />
    </MasterPresenceProvider>
  );
}
