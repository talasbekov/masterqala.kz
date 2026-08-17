'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  BoltIcon,
  Button,
  CalendarIcon,
  EmptyState,
  SkeletonList,
  Table,
  type TableColumn,
} from '@masterqala/ui';
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

  const columns: TableColumn<Item>[] = [
    {
      key: 'mode',
      header: t('myOrders.columns.mode'),
      width: '104px',
      cell: (it) =>
        it.kind === 'urgent' ? (
          <Badge tone="urgent" icon={<BoltIcon size={14} />}>
            {t('myOrders.modeUrgent')}
          </Badge>
        ) : (
          <Badge tone="primary" icon={<CalendarIcon size={14} />}>
            {t('myOrders.modePlanned')}
          </Badge>
        ),
    },
    {
      key: 'category',
      header: t('myOrders.columns.category'),
      cell: (it) => <span className="font-bold text-ink">{it.category?.name ?? '—'}</span>,
    },
    {
      key: 'number',
      header: t('myOrders.columns.number'),
      hideBelow: 'lg',
      cell: (it) => <span className="text-ink-soft">№{it.id.slice(0, 8)}</span>,
    },
    {
      key: 'status',
      header: t('myOrders.columns.status'),
      cell: (it) => {
        const label = it.kind === 'urgent' ? STATUS_LABELS[it.status] : PLANNED_STATUS_LABELS[it.status];
        const variant = it.kind === 'urgent' ? urgentStatusVariant(it.status) : plannedStatusVariant(it.status);
        const tone = variant === 'success' ? 'success' : variant === 'danger' ? 'danger' : 'primary';
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
    {
      key: 'date',
      header: t('myOrders.columns.date'),
      hideBelow: 'md',
      cell: (it) => <span className="text-ink-soft">{new Date(it.createdAt).toLocaleDateString('ru-RU')}</span>,
    },
    {
      key: 'price',
      header: t('myOrders.columns.price'),
      align: 'right',
      cell: (it) => {
        const price = it.kind === 'urgent' ? (it.workPrice ?? it.calloutPrice) : (it.workPrice ?? it.budget);
        return <span className="font-bold text-ink">{price != null ? `${price} ₸` : '—'}</span>;
      },
    },
    {
      key: 'master',
      header: t('myOrders.columns.master'),
      hideBelow: 'md',
      cell: (it) => <span className="text-ink-soft">{it.master?.name ?? '—'}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4 px-5 py-6 sm:px-8">
      <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{t('myOrders.title')}</h1>
      <div className="flex w-fit gap-1 rounded-pill bg-fill-soft p-1" role="group" aria-label={t('myOrders.title')}>
        <Button
          variant={tab === 'active' ? 'primary' : 'ghost'}
          size="sm"
          aria-pressed={tab === 'active'}
          onClick={() => setTab('active')}
        >
          {t('myOrders.active')}
        </Button>
        <Button
          variant={tab === 'history' ? 'primary' : 'ghost'}
          size="sm"
          aria-pressed={tab === 'history'}
          onClick={() => setTab('history')}
        >
          {t('myOrders.history')}
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && <SkeletonList rows={4} label={t('common.loading')} />}
      {!loading && (
        <Table
          caption={t('myOrders.tableCaption')}
          columns={columns}
          rows={shown}
          rowKey={(it) => it.id}
          onRowClick={(it) => router.push(it.kind === 'urgent' ? `/order/${it.id}` : `/planned/${it.id}`)}
          empty={
            <EmptyState title={tab === 'active' ? t('myOrders.emptyActive') : t('myOrders.emptyHistory')} />
          }
        />
      )}
    </div>
  );
}
