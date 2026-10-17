'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from '@masterqala/ui';
import { protectedLoginUrl } from '@/lib/auth-return';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: ReactNode }) {
  // Cookie-backed locale is identical during SSR and first hydration, before
  // the legacy i18next bridge has synchronized browser storage.
  const { t } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace(protectedLoginUrl(pathname, search));
    } else {
      setChecked(true);
    }
  }, [user, router, pathname, search]);

  if (!user || !checked) return <div className="p-6 text-ink-soft" role="status">{t('loading')}</div>;
  return <>{children}</>;
}
