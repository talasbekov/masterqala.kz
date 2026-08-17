'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  BoltIcon,
  Badge,
  Button,
  CalendarIcon,
  Card,
  ChevronRightIcon,
  HelpIcon,
  ShieldIcon,
  Skeleton,
  SkeletonList,
} from '@masterqala/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCommercialMode } from '@/lib/commercial-mode';
import { getSocket } from '@/lib/socket';
import { STATUS_LABELS } from '@/lib/orderStatus';
import { categoryMeta } from '@/lib/categoryMeta';

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface ActiveOrder {
  id: string;
  status: string;
  category: { name: string } | null;
}

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { paymentsEnabled } = useCommercialMode();
  const router = useRouter();
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api('/orders/active')
      .then((r) => setOrder(r.order))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    api('/categories').then(setCategories);
    const socket = getSocket();
    const onStatus = () => load();
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:status', onStatus);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3.5 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
        <Skeleton shape="text" className="h-7 w-1/2" />
        <SkeletonList rows={3} label={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3.5 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">
          {t('home.greeting', { name: user?.name ?? t('home.guestName') })}
        </h1>
        <Link
          href="/support"
          aria-label={t('orderDetail.support')}
          title={t('orderDetail.support')}
          className="flex size-11 shrink-0 items-center justify-center rounded-pill border border-border-strong bg-surface text-ink-soft"
        >
          <HelpIcon size={20} />
        </Link>
      </div>

      {order && (
        <Link
          href={`/order/${order.id}`}
          className="flex items-center gap-3 rounded-lg bg-primary p-4 text-left text-on-primary transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-primary-hover"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-extrabold text-ink">
            {order.category?.name?.slice(0, 2).toUpperCase() ?? '—'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold">{order.category?.name}</span>
            <span className="block truncate text-xs font-semibold">{STATUS_LABELS[order.status]}</span>
          </span>
          <ChevronRightIcon size={20} />
        </Link>
      )}

      {/* Оранжевый в системе означает срочность — только режим «Сейчас». */}
      <Card className="border-2 border-urgent">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-base font-extrabold text-ink">
            <BoltIcon size={20} className="text-urgent" />
            {t('home.urgentTitle')}
          </span>
          <Badge tone="urgent">{t('home.urgentEta')}</Badge>
        </div>
        <p className="mt-1.5 text-xs leading-snug text-ink-soft">
          {paymentsEnabled
            ? t('home.urgentDescription')
            : 'Найдём ближайшего мастера. Выезд бесплатный, стоимость работ подтвердите после осмотра и оплатите мастеру напрямую.'}
        </p>
        <Button
          variant="urgent"
          fullWidth
          className="mt-2.5"
          icon={<BoltIcon size={18} />}
          onClick={() => router.push('/order/new')}
        >
          {t('home.urgentButton')}
        </Button>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-base font-extrabold text-ink">
            <CalendarIcon size={20} className="text-primary" />
            {t('home.plannedTitle')}
          </span>
          <Badge tone="primary">{t('home.plannedBadge')}</Badge>
        </div>
        <p className="mt-1.5 text-xs leading-snug text-ink-soft">{t('home.plannedDescription')}</p>
        <Button
          variant="secondary"
          fullWidth
          className="mt-2.5"
          icon={<CalendarIcon size={18} />}
          onClick={() => router.push('/planned/new')}
        >
          {t('home.plannedButton')}
        </Button>
      </Card>

      {categories.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-extrabold text-ink">{t('home.categoriesTitle')}</h2>
            <Link href="/catalog" className="text-xs font-extrabold text-primary">
              {t('home.categoriesAll')}
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((c) => {
              const { Icon } = categoryMeta(c.slug);
              return (
                <li key={c.id}>
                  <Link
                    href="/order/new"
                    className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface px-1.5 py-3 text-center transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-surface-sunken"
                  >
                    <Icon size={22} className="text-primary" />
                    <span className="text-2xs font-bold text-ink">{c.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex items-center gap-2.5 rounded-md bg-fill-soft px-3.5 py-3">
        <ShieldIcon size={20} className="shrink-0 text-primary" />
        <p className="text-xs leading-snug font-semibold text-on-fill">
          {paymentsEnabled
            ? t('home.trustBanner')
            : 'Все мастера проходят проверку документов. В пилоте расчёт происходит напрямую с мастером; при проблеме доступны спор и поддержка.'}
        </p>
      </div>
    </div>
  );
}
