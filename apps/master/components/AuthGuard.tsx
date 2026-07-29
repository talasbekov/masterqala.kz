'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: ReactNode }) {
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

  if (!checked) return <div className="p-6 text-ink-soft">Загрузка…</div>;
  return <>{children}</>;
}
