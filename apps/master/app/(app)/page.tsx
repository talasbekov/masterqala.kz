'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, EmptyState, SkeletonList, WrenchIcon } from '@masterqala/ui';
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

  if (!loaded) {
    return (
      <div className="mx-auto w-full max-w-lg p-4 sm:p-6 md:p-8">
        <SkeletonList rows={3} label="Загружаем статус анкеты" />
      </div>
    );
  }

  if (!application || application.status !== 'ACTIVE') {
    return (
      <div className="mx-auto w-full max-w-lg p-4 sm:p-6 md:p-8">
        <EmptyState
          icon={<WrenchIcon size={32} />}
          title={
            application ? APPLICATION_STATUS_RU[application.status] : 'Вы ещё не подали анкету мастера'
          }
          subtitle={
            application?.status === 'REJECTED' && application.rejectionReason
              ? `Причина: ${application.rejectionReason}`
              : application?.status === 'NEEDS_INFO' && application.latestDecisionComment
                ? `Что нужно дополнить: ${application.latestDecisionComment}`
                : 'Доступ к заявкам открывается после проверки анкеты оператором.'
          }
          action={
            <Link
              href="/become-master"
              className="inline-flex min-h-11 items-center rounded-pill bg-primary px-5 text-base font-extrabold text-on-primary transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-primary-hover"
            >
              {application ? 'Открыть анкету' : 'Подать анкету'}
            </Link>
          }
        />
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
      <div className="mx-auto mt-4 flex w-full max-w-lg rounded-pill border border-border p-1 md:mt-8">
        <button
          type="button"
          aria-pressed={tab === 'urgent'}
          className={`min-h-11 flex-1 rounded-pill text-sm font-extrabold transition-colors duration-(--duration-fast) ease-(--ease-out) ${
            tab === 'urgent' ? 'bg-primary text-on-primary' : 'text-ink-soft'
          }`}
          onClick={() => setTab('urgent')}
        >
          Срочные
        </button>
        <button
          type="button"
          aria-pressed={tab === 'planned'}
          className={`min-h-11 flex-1 rounded-pill text-sm font-extrabold transition-colors duration-(--duration-fast) ease-(--ease-out) ${
            tab === 'planned' ? 'bg-primary text-on-primary' : 'text-ink-soft'
          }`}
          onClick={() => setTab('planned')}
        >
          Плановые
        </button>
      </div>

      {tab === 'urgent' && (
        <div className="mx-auto w-full max-w-lg space-y-3 p-4 sm:p-6 md:p-8">
          <Card className="text-center">
            <h1 className="text-lg font-extrabold text-ink">Здравствуйте, {user?.name ?? user?.phone}</h1>
            <p className="mt-3 text-sm text-ink-soft">
              {online
                ? 'Ждём заявки рядом с вами…'
                : 'Нажмите «Стать онлайн» в панели разделов, чтобы получать срочные заявки.'}
            </p>
          </Card>
          {geoDenied && (
            <Alert tone="warning" title="Нет доступа к геолокации">
              Без доступа к геолокации заявки приходить не будут. Разрешите доступ в настройках браузера
              и попробуйте снова.
            </Alert>
          )}
        </div>
      )}
      {tab === 'planned' && <PlannedFeedView />}
    </div>
  );
}
