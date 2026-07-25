import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import {
  STATUS_LABELS,
  PLANNED_STATUS_LABELS,
  urgentStatusVariant,
  plannedStatusVariant,
  isTerminalStatus,
  isPlannedTerminalStatus,
} from '../../../orderStatus';

interface UrgentOrder {
  id: string;
  status: string;
  category: { name: string } | null;
  createdAt: string;
  calloutPrice: number;
  workPrice: number | null;
  master: { name: string | null } | null;
}
interface PlannedOrderItem {
  id: string;
  status: string;
  category: { name: string } | null;
  createdAt: string;
  budget: number | null;
  workPrice: number | null;
  master: { name: string | null } | null;
}
type Item = (UrgentOrder & { kind: 'urgent' }) | (PlannedOrderItem & { kind: 'planned' });

export default function MyOrdersPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/orders'), api('/planned-orders/mine')])
      .then(([urgent, planned]: [UrgentOrder[], PlannedOrderItem[]]) => {
        const merged: Item[] = [
          ...urgent.map((o) => ({ ...o, kind: 'urgent' as const })),
          ...planned.map((o) => ({ ...o, kind: 'planned' as const })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setItems(merged);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const isActive = (it: Item) =>
    it.kind === 'urgent' ? !isTerminalStatus(it.status) : !isPlannedTerminalStatus(it.status);
  const shown = items.filter((it) => (tab === 'active' ? isActive(it) : !isActive(it)));

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="text-[22px] font-extrabold text-ink">{t('myOrders.title')}</div>
      <div className="flex rounded-pill bg-fill p-1">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`flex-1 rounded-pill py-2 text-[13px] font-extrabold ${
            tab === 'active' ? 'bg-surface text-ink shadow-card' : 'text-ink-soft'
          }`}
        >
          {t('myOrders.active')}
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`flex-1 rounded-pill py-2 text-[13px] font-extrabold ${
            tab === 'history' ? 'bg-surface text-ink shadow-card' : 'text-ink-soft'
          }`}
        >
          {t('myOrders.history')}
        </button>
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      {!loading && shown.length === 0 && (
        <div className="rounded-lg border-[1.5px] border-dashed border-border bg-surface p-6 text-center text-sm font-semibold text-ink-soft">
          {tab === 'active' ? t('myOrders.emptyActive') : t('myOrders.emptyHistory')}
        </div>
      )}
      {shown.map((it) => {
        const label = it.kind === 'urgent' ? STATUS_LABELS[it.status] : PLANNED_STATUS_LABELS[it.status];
        const variant = it.kind === 'urgent' ? urgentStatusVariant(it.status) : plannedStatusVariant(it.status);
        const price = it.kind === 'urgent' ? (it.workPrice ?? it.calloutPrice) : (it.workPrice ?? it.budget);
        return (
          <Link
            key={it.id}
            to={it.kind === 'urgent' ? `/order/${it.id}` : `/planned/${it.id}`}
            className="rounded-lg border border-border bg-surface p-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-extrabold text-ink">
                {it.kind === 'urgent' ? '⚡' : '📅'} {it.category?.name} · №{it.id.slice(0, 8)}
              </span>
              <span
                className={`shrink-0 rounded-pill px-2.5 py-1 text-[10.5px] font-extrabold ${
                  variant === 'success'
                    ? 'bg-success-bg text-success-ink'
                    : variant === 'danger'
                      ? 'bg-danger-bg text-danger-ink'
                      : 'bg-fill-soft text-primary'
                }`}
              >
                {label}
              </span>
            </div>
            <div className="mt-1 text-xs text-ink-soft">
              {new Date(it.createdAt).toLocaleDateString('ru-RU')}
              {price != null && ` · ${price} ₸`}
              {it.master?.name && ` · ${it.master.name}`}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
