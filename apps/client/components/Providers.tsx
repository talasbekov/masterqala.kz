'use client';
import type { ReactNode } from 'react';
import '@/lib/i18n';
import { AuthProvider } from '@/lib/auth';
import { CommercialModeProvider } from '@/lib/commercial-mode';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CommercialModeProvider>
      <AuthProvider>{children}</AuthProvider>
    </CommercialModeProvider>
  );
}
