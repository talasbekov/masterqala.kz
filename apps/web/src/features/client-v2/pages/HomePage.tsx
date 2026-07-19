import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { getSocket } from '../../../socket';
import { useAuth } from '../../../auth';
import { STATUS_LABELS } from '../../../orderStatus';
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

  if (loading) return <div className="p-6 text-c2-ink-soft">{t('common.loading')}</div>;

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[22px] font-extrabold text-c2-ink">
          {t('home.greeting', { name: user?.name ?? t('home.guestName') })}
        </div>
        <Link
          to="/support"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-c2-border bg-c2-surface text-base"
        >
          ?
        </Link>
      </div>

      {order && (
        <button
          type="button"
          onClick={() => navigate(`/order/${order.id}`)}
          className="flex items-center gap-3 rounded-c2-lg bg-c2-primary p-4 text-left"
        >
          <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-c2-fill text-[13px] font-extrabold text-c2-ink">
            {order.category?.name?.slice(0, 2).toUpperCase() ?? '—'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold text-white">{order.category?.name}</div>
            <div className="truncate text-xs font-semibold text-c2-fill">{STATUS_LABELS[order.status]}</div>
          </div>
          <span className="text-lg text-c2-fill">›</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => navigate('/order/new')}
        className="rounded-c2-lg border-2 border-c2-primary bg-c2-surface p-4 text-left shadow-c2-card"
      >
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold text-c2-ink">⚡ {t('home.urgentTitle')}</span>
          <span className="rounded-c2-pill bg-c2-fill-soft px-2.5 py-1 text-[11.5px] font-extrabold text-c2-primary">
            {t('home.urgentEta')}
          </span>
        </div>
        <div className="mt-1.5 text-[12.5px] leading-snug text-c2-ink-soft">{t('home.urgentDescription')}</div>
        <div className="mt-2.5 rounded-c2-pill bg-c2-primary p-2.5 text-center text-sm font-extrabold text-white">
          {t('home.urgentButton')}
        </div>
      </button>

      <Link
        to="/planned/new"
        className="rounded-c2-lg border-2 border-c2-border bg-c2-surface p-4 text-left shadow-c2-card"
      >
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-extrabold text-c2-ink">📅 {t('home.plannedTitle')}</span>
          <span className="rounded-c2-pill bg-c2-fill-soft px-2.5 py-1 text-[11.5px] font-extrabold text-c2-primary">
            {t('home.plannedBadge')}
          </span>
        </div>
        <div className="mt-1.5 text-[12.5px] leading-snug text-c2-ink-soft">{t('home.plannedDescription')}</div>
        <div className="mt-2.5 rounded-c2-pill border-[1.5px] border-c2-primary p-2.5 text-center text-sm font-extrabold text-c2-primary">
          {t('home.plannedButton')}
        </div>
      </Link>

      {categories.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[15px] font-extrabold text-c2-ink">{t('home.categoriesTitle')}</span>
            <Link to="/catalog" className="text-[12.5px] font-extrabold text-c2-primary">
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
                  className="rounded-c2-md border border-c2-border bg-c2-surface px-1.5 py-3 text-center"
                >
                  <div className="mb-1 text-xl">{meta.icon}</div>
                  <div className="text-[11.5px] font-bold text-c2-ink">{c.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-c2-md bg-c2-fill px-3.5 py-3">
        <span className="text-lg">🛡️</span>
        <div className="text-xs font-semibold leading-snug text-c2-ink">{t('home.trustBanner')}</div>
      </div>
    </div>
  );
}
