'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useMasterPresence } from '@/lib/masterPresence';
import { getSocket } from '@/lib/socket';
import { APPLICATION_STATUS_RU, fetchApplication, type Application } from '@/lib/masterApplication';
import { fetchActiveOrder, type ActiveOrder } from '@/lib/activeOrder';
import { ActiveOrderView } from '@/components/ActiveOrderView';
import { PlannedFeedView } from '@/components/PlannedFeedView';

type Tab = 'urgent' | 'planned';

export default function WorkDashboardPage() {
  const { user } = useAuth();
  const { online, geoDenied } = useMasterPresence();
  const [application, setApplication] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('urgent');
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);

  useEffect(() => {
    fetchApplication().then((app) => {
      setApplication(app);
      setLoaded(true);
    });
  }, []);

  const loadActive = useCallback(() => {
    fetchActiveOrder().then(setActiveOrder);
  }, []);

  useEffect(() => {
    if (!application || application.status !== 'ACTIVE') return;
    loadActive();
    const socket = getSocket();
    const onStatus = () => loadActive();
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:status', onStatus);
    };
  }, [application, loadActive]);

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

  if (activeOrder) {
    return (
      <div className="h-full">
        <ActiveOrderView order={activeOrder} onChanged={loadActive} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto mt-8 flex w-full max-w-[480px] rounded-pill border border-border p-1">
        <button
          className={`flex-1 rounded-pill py-2 text-sm font-extrabold ${tab === 'urgent' ? 'bg-primary text-white' : 'text-ink-soft'}`}
          onClick={() => setTab('urgent')}
        >
          Срочные
        </button>
        <button
          className={`flex-1 rounded-pill py-2 text-sm font-extrabold ${tab === 'planned' ? 'bg-primary text-white' : 'text-ink-soft'}`}
          onClick={() => setTab('planned')}
        >
          Плановые
        </button>
      </div>

      {tab === 'urgent' && (
        <div className="mx-auto max-w-[480px] p-8 text-center">
          <div className="text-lg font-extrabold text-ink">Здравствуйте, {user?.name ?? user?.phone}</div>
          <p className="mt-3 text-sm text-ink-soft">
            {online
              ? 'Ждём заявки рядом с вами…'
              : 'Нажмите «Стать онлайн» в боковой панели, чтобы получать срочные заявки.'}
          </p>
          {geoDenied && (
            <p className="mt-3 rounded-md bg-fill-soft p-3 text-sm text-ink-soft">
              Без доступа к геолокации заявки приходить не будут. Разрешите доступ в настройках браузера и попробуйте снова.
            </p>
          )}
        </div>
      )}
      {tab === 'planned' && <PlannedFeedView />}
    </div>
  );
}
