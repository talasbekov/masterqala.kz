import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { useAuth } from '../../../auth';
import { useCommercialMode } from '../../../commercial-mode';
import { getSocket } from '../../../socket';
import { STATUS_LABELS } from '../../../orderStatus';
import {
  BoltIcon,
  Badge,
  CalendarIcon,
  ChevronRightIcon,
  HelpIcon,
  ShieldIcon,
  SkeletonList,
} from '@masterqala/ui';
import { categoryMeta } from '../categoryMeta';

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
  const navigate = useNavigate();
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
    return <SkeletonList rows={3} label={t('common.loading')} className="px-5 pt-1.5" />;
  }

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">
          {t('home.greeting', { name: user?.name ?? t('home.guestName') })}
        </h1>
        <Link
          to="/support"
          aria-label={t('common.help')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-soft"
        >
          <HelpIcon />
        </Link>
      </div>

      {order && (
        <button
          type="button"
          onClick={() => navigate(`/order/${order.id}`)}
          className="flex items-center gap-3 rounded-lg bg-primary p-4 text-left"
        >
          <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-extrabold text-ink">
            {order.category?.name?.slice(0, 2).toUpperCase() ?? '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold text-on-primary">{order.category?.name}</div>
            <div className="truncate text-xs font-semibold text-fill">{STATUS_LABELS[order.status]}</div>
          </div>
          <ChevronRightIcon className="shrink-0 text-fill" />
        </button>
      )}

      <button
        type="button"
        onClick={() => navigate('/order/new')}
        className="rounded-lg border-2 border-primary bg-surface p-4 text-left shadow-card"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-base font-extrabold text-ink">
            <BoltIcon size={20} className="text-urgent" />
            {t('home.urgentTitle')}
          </span>
          {/* Оранжевый = срочность: режим «Сейчас» — единственное его место. */}
          <Badge tone="urgent">{t('home.urgentEta')}</Badge>
        </div>
        <div className="mt-1.5 text-xs leading-snug text-ink-soft">
          {paymentsEnabled
            ? t('home.urgentDescription')
            : 'Найдём ближайшего мастера. Выезд бесплатный, стоимость работ подтвердите после осмотра и оплатите мастеру напрямую.'}
        </div>
        <div className="mt-2.5 min-h-11 rounded-pill bg-urgent p-2.5 text-center text-sm font-extrabold text-on-urgent">
          {t('home.urgentButton')}
        </div>
      </button>

      <Link
        to="/planned/new"
        className="rounded-lg border-2 border-border bg-surface p-4 text-left shadow-card"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-base font-extrabold text-ink">
            <CalendarIcon size={20} className="text-primary" />
            {t('home.plannedTitle')}
          </span>
          <Badge tone="primary">{t('home.plannedBadge')}</Badge>
        </div>
        <div className="mt-1.5 text-xs leading-snug text-ink-soft">{t('home.plannedDescription')}</div>
        <div className="mt-2.5 min-h-11 rounded-pill border border-primary p-2.5 text-center text-sm font-extrabold text-primary">
          {t('home.plannedButton')}
        </div>
      </Link>

      {categories.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-extrabold text-ink">{t('home.categoriesTitle')}</span>
            <Link to="/catalog" className="text-xs font-extrabold text-primary">
              {t('home.categoriesAll')}
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((c) => {
              const meta = categoryMeta(c.slug);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate('/order/new')}
                  className="min-h-11 rounded-md border border-border bg-surface px-1.5 py-3 text-center"
                >
                  <div className="mb-1 flex justify-center text-primary">{meta.icon}</div>
                  <div className="text-2xs font-bold text-ink">{c.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-md bg-fill px-3.5 py-3">
        <ShieldIcon size={20} className="shrink-0 text-primary" />
        <div className="text-xs font-semibold leading-snug text-ink">
          {paymentsEnabled
            ? t('home.trustBanner')
            : 'Все мастера проходят проверку документов. В пилоте расчёт происходит напрямую с мастером; при проблеме доступны спор и поддержка.'}
        </div>
      </div>
    </div>
  );
}
