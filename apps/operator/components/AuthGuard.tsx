'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, SkeletonList } from '@masterqala/ui';
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

  if (!checked || !user)
    return <SkeletonList rows={4} label="Проверка доступа" className="p-6" />;

  if (user.role !== 'OPERATOR') {
    return (
      <div className="flex flex-col items-start gap-3 p-8">
        <Alert tone="danger" title="Доступ запрещён">
          Панель оператора доступна только пользователям с ролью «Оператор». Ваш аккаунт не имеет
          такой роли.
        </Alert>
        <Button onClick={logout}>Выйти и войти другим аккаунтом</Button>
      </div>
    );
  }

  return <>{children}</>;
}
