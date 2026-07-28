'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    } else {
      setChecked(true);
    }
  }, [user, router]);

  if (!checked) return <div className="p-6 text-ink-soft">{t('common.loading')}</div>;
  return <>{children}</>;
}
