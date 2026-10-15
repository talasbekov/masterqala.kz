'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { protectedLoginUrl } from '@/lib/auth-return';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
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

  if (!user || !checked) return <div className="p-6 text-ink-soft">{t('common.loading')}</div>;
  return <>{children}</>;
}
