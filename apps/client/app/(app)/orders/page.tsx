'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import {
  STATUS_LABELS,
  PLANNED_STATUS_LABELS,
  urgentStatusVariant,
  plannedStatusVariant,
  isTerminalStatus,
  isPlannedTerminalStatus,
} from '@/lib/orderStatus';

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
  const router = useRouter();
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
    <div className="flex flex-col gap-4 px-8 py-6">
      <div className="text-[22px] font-extrabold text-ink">{t('myOrders.title')}</div>
      <div className="flex w-fit rounded-pill bg-fill p-1">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`rounded-pill px-6 py-2 text-[13px] font-extrabold ${
            tab === 'active' ? 'bg-surface text-ink shadow-card' : 'text-ink-soft'
          }`}
        >
          {t('myOrders.active')}
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`rounded-pill px-6 py-2 text-[13px] font-extrabold ${
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
      {shown.length > 0 && (
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-border text-sm">
          <thead>
            <tr className="bg-fill-soft text-left text-xs font-extrabold text-ink-soft">
              <th className="p-3">Режим</th>
              <th className="p-3">Категория</th>
              <th className="p-3">№</th>
              <th className="p-3">Статус</th>
              <th className="p-3">Дата</th>
              <th className="p-3">Цена</th>
              <th className="p-3">Мастер</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((it) => {
              const label = it.kind === 'urgent' ? STATUS_LABELS[it.status] : PLANNED_STATUS_LABELS[it.status];
              const variant = it.kind === 'urgent' ? urgentStatusVariant(it.status) : plannedStatusVariant(it.status);
              const price = it.kind === 'urgent' ? (it.workPrice ?? it.calloutPrice) : (it.workPrice ?? it.budget);
              return (
                <tr
                  key={it.id}
                  onClick={() => router.push(it.kind === 'urgent' ? `/order/${it.id}` : `/planned/${it.id}`)}
                  className="cursor-pointer border-t border-border hover:bg-fill-faint"
                >
                  <td className="p-3">{it.kind === 'urgent' ? '⚡' : '📅'}</td>
                  <td className="p-3 font-bold text-ink">{it.category?.name ?? '—'}</td>
                  <td className="p-3 text-ink-soft">№{it.id.slice(0, 8)}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-pill px-2.5 py-1 text-[10.5px] font-extrabold ${
                        variant === 'success'
                          ? 'bg-success-bg text-success-ink'
                          : variant === 'danger'
                            ? 'bg-danger-bg text-danger-ink'
                            : 'bg-fill-soft text-primary'
                      }`}
                    >
                      {label}
                    </span>
                  </td>
                  <td className="p-3 text-ink-soft">{new Date(it.createdAt).toLocaleDateString('ru-RU')}</td>
                  <td className="p-3 font-bold text-ink">{price != null ? `${price} ₸` : '—'}</td>
                  <td className="p-3 text-ink-soft">{it.master?.name ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
