'use client';
import { useAuth } from '@/lib/auth';

export default function WorkDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <div className="text-xl font-extrabold text-ink">Здравствуйте, {user?.name ?? user?.phone}</div>
    </div>
  );
}
