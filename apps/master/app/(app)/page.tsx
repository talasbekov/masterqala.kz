'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { APPLICATION_STATUS_RU, fetchApplication, type Application } from '@/lib/masterApplication';

export default function WorkDashboardPage() {
  const { user } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchApplication().then((app) => {
      setApplication(app);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <div className="p-8 text-ink-soft">Загрузка…</div>;

  if (!application || application.status !== 'ACTIVE') {
    return (
      <div className="mx-auto max-w-[480px] p-8">
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <div className="text-lg font-extrabold text-ink">
            {application ? APPLICATION_STATUS_RU[application.status] : 'Вы ещё не подали анкету мастера'}
          </div>
          {application?.status === 'REJECTED' && application.rejectionReason && (
            <p className="mt-2 text-sm text-danger">Причина: {application.rejectionReason}</p>
          )}
          {application?.status === 'NEEDS_INFO' && application.latestDecisionComment && (
            <p className="mt-2 text-sm text-ink-soft">Что нужно дополнить: {application.latestDecisionComment}</p>
          )}
          <Link
            href="/become-master"
            className="mt-4 inline-block rounded-pill bg-primary px-5 py-3 text-sm font-extrabold text-white"
          >
            {application ? 'Открыть анкету' : 'Подать анкету'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="text-xl font-extrabold text-ink">Здравствуйте, {user?.name ?? user?.phone}</div>
      <div className="mt-3 rounded-lg border border-border bg-surface p-6 text-sm text-ink-soft">
        Рабочая лента (срочные и плановые заявки) появится в Фазе 2.
      </div>
    </div>
  );
}
