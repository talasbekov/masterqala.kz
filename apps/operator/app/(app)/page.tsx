'use client';
import Link from 'next/link';
import {
  Alert,
  Card,
  EmptyState,
  SkeletonList,
  Table,
  type TableColumn,
} from '@masterqala/ui';
import { useOperatorMetrics } from '@/lib/operatorMetrics';
import type { StuckSearch } from '@/lib/metrics';

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function AttentionCard({
  href,
  count,
  label,
  danger,
}: {
  href: string;
  count: number;
  label: string;
  danger?: boolean;
}) {
  // Тревожный цвет — только когда есть чему тревожиться. При нуле карточка
  // нейтральная: иначе оператор постоянно видит четыре красно-оранжевых блока
  // и перестаёт их замечать ровно тогда, когда счётчик наконец вырастет.
  const active = count > 0;
  const tone = !active
    ? 'border-border'
    : danger
      ? 'border-danger'
      : 'border-warning';
  const valueTone = !active
    ? 'text-ink-muted'
    : danger
      ? 'text-danger'
      : 'text-warning-ink';

  return (
    <Link
      href={href}
      className={`rounded-lg border-2 bg-surface p-4 text-left transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-surface-sunken ${tone}`}
    >
      <span className={`block text-2xl font-extrabold ${valueTone}`}>{count}</span>
      <span className="block text-xs font-bold text-ink-soft">{label}</span>
      {/* Цвет — не единственный носитель смысла: состояние названо словом. */}
      <span className="sr-only">{active ? '— требует внимания' : '— в норме'}</span>
    </Link>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <Card>
      <div className="text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs font-bold text-ink-soft">{label}</div>
    </Card>
  );
}

export default function OverviewPage() {
  const { metrics, loading, error } = useOperatorMetrics();

  if (loading && !metrics)
    return <SkeletonList rows={4} label="Загрузка сводки" className="p-4 lg:p-8" />;
  if (error)
    return (
      <div className="p-4 lg:p-8">
        <Alert tone="danger" title="Ошибка загрузки">
          {error}
        </Alert>
      </div>
    );
  if (!metrics) return null;

  const needsAttention = metrics.stuckSearches.length > 0 || metrics.openDisputesCount > 0;

  const stuckColumns: TableColumn<StuckSearch>[] = [
    { key: 'id', header: 'ID', width: '90px', cell: (s) => `#${s.id.slice(0, 6)}` },
    { key: 'category', header: 'Категория', width: '150px', hideBelow: 'md', cell: (s) => s.category },
    { key: 'address', header: 'Адрес', cell: (s) => s.address },
    {
      key: 'wave',
      header: 'Волна',
      width: '160px',
      cell: (s) => (
        <span className="font-bold text-danger">
          волна {s.wave} · {formatSeconds(s.waitingSeconds)}
        </span>
      ),
    },
    {
      key: 'go',
      header: 'Действия',
      width: '170px',
      align: 'right',
      cell: (s) => (
        <Link
          href={`/orders/${s.id}`}
          className="inline-flex min-h-9 items-center rounded-pill bg-primary px-3 text-xs font-extrabold text-on-primary transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-primary-hover"
        >
          Перейти к заказу
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <h1 className="text-2xl font-extrabold text-ink">Обзор</h1>

      {needsAttention && <h2 className="text-sm font-extrabold text-danger">Требует внимания</h2>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AttentionCard href="/orders" count={metrics.stuckSearches.length} label="поиск без мастера > 5 мин" danger />
        <AttentionCard href="/disputes" count={metrics.openDisputesCount} label="открытых спора" />
        <AttentionCard href="/verification" count={metrics.pendingVerificationCount} label="анкеты на верификации" />
        <AttentionCard href="/withdrawals" count={metrics.pendingWithdrawalsCount} label="заявки на вывод" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard value={String(metrics.activeUrgentCount)} label="активных срочных" />
        <MetricCard value={String(metrics.publishedPlannedCount)} label="плановых опубликовано" />
        <MetricCard
          value={metrics.foundMasterRate === null ? '—' : `${metrics.foundMasterRate}%`}
          label="заказов нашли мастера"
        />
        <MetricCard value={formatSeconds(metrics.medianSearchSeconds)} label="медиана времени поиска" />
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-extrabold text-ink">
          Поиск без мастера — вмешательство оператора
        </h2>
        {metrics.stuckSearches.length === 0 ? (
          <EmptyState title="Нет заявок, требующих вмешательства" />
        ) : (
          <Table
            caption="Заявки, зависшие в поиске мастера: ID, категория, адрес и время ожидания"
            columns={stuckColumns}
            rows={metrics.stuckSearches}
            rowKey={(s) => s.id}
          />
        )}
      </Card>
    </div>
  );
}
