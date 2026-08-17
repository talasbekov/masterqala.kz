'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      setChecked(false);
      router.replace('/login');
    } else {
      setChecked(true);
    }
  }, [user, router]);

  if (!checked || !user) return <div className="p-6 text-ink-soft">Загрузка…</div>;

  if (user.role !== 'OPERATOR') {
    return (
      <div className="flex flex-col items-start gap-3 p-8">
        <div className="text-lg font-extrabold text-danger">Доступ запрещён</div>
        <div className="text-sm text-ink-soft">
          Панель оператора доступна только пользователям с ролью «Оператор». Ваш аккаунт не имеет такой роли.
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-pill bg-primary px-4 py-2 text-sm font-extrabold text-white"
        >
          Выйти и войти другим аккаунтом
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
