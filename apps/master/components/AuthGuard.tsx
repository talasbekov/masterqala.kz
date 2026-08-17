'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { SkeletonList } from '@masterqala/ui';
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

  if (!checked) {
    return (
      <div className="mx-auto w-full max-w-lg p-4 sm:p-6 md:p-8">
        <SkeletonList rows={3} label="Проверяем доступ" />
      </div>
    );
  }
  return <>{children}</>;
}
