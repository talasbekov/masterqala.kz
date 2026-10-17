'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {useLocale} from '@masterqala/ui';
import {masterLoginUrl} from '../lib/auth-return';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user,ready } = useAuth();
  const {language}=useLocale();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if(!ready)return;
    if (!user) {
      setChecked(false);
      router.replace(masterLoginUrl(window.location.pathname+window.location.search));
    } else {
      setChecked(true);
    }
  }, [user, ready, router]);

  if (!checked || !user) return <div className="p-6 text-ink-soft" role="status">{{ru:'Загрузка…',kk:'Жүктелуде…',en:'Loading…'}[language]}</div>;
  return <>{children}</>;
}
