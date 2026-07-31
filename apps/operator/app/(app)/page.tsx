'use client';
import Link from 'next/link';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

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
  return (
    <Link
      href={href}
      className={`rounded-lg border-[1.5px] bg-surface p-4 text-left ${danger ? 'border-danger' : 'border-warning-ink'}`}
    >
      <div className={`text-2xl font-extrabold ${danger ? 'text-danger' : 'text-warning-ink'}`}>{count}</div>
      <div className="text-xs font-bold text-ink-soft">{label}</div>
    </Link>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs font-bold text-ink-soft">{label}</div>
    </div>
  );
}

export default function OverviewPage() {
  const { metrics, loading, error } = useOperatorMetrics();

  if (loading && !metrics) return <div className="p-8 text-ink-soft">Загрузка…</div>;
  if (error) return <div className="p-8 text-danger">Ошибка загрузки: {error}</div>;
  if (!metrics) return null;

  const needsAttention = metrics.stuckSearches.length > 0 || metrics.openDisputesCount > 0;

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="text-2xl font-extrabold text-ink">Обзор</div>

      {needsAttention && <div className="text-sm font-extrabold text-danger">Требует внимания</div>}
      <div className="grid grid-cols-4 gap-3">
        <AttentionCard href="/orders" count={metrics.stuckSearches.length} label="поиск без мастера > 5 мин" danger />
        <AttentionCard href="/disputes" count={metrics.openDisputesCount} label="открытых спора" />
        <AttentionCard href="/verification" count={metrics.pendingVerificationCount} label="анкеты на верификации" />
        <AttentionCard href="/withdrawals" count={metrics.pendingWithdrawalsCount} label="заявки на вывод" />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <MetricCard value={String(metrics.activeUrgentCount)} label="активных срочных" />
        <MetricCard value={String(metrics.publishedPlannedCount)} label="плановых опубликовано" />
        <MetricCard
          value={metrics.foundMasterRate === null ? '—' : `${metrics.foundMasterRate}%`}
          label="заказов нашли мастера"
        />
        <MetricCard value={formatSeconds(metrics.medianSearchSeconds)} label="медиана времени поиска" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 text-sm font-extrabold text-ink">Поиск без мастера — вмешательство оператора</div>
        {metrics.stuckSearches.length === 0 ? (
          <div className="text-sm text-ink-soft">Нет заявок, требующих вмешательства</div>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-[80px_130px_1fr_110px_150px] gap-3 border-b border-fill-soft pb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
              <span>ID</span>
              <span>Категория</span>
              <span>Адрес</span>
              <span>Волна</span>
              <span></span>
            </div>
            {metrics.stuckSearches.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[80px_130px_1fr_110px_150px] items-center gap-3 border-b border-fill-soft py-2.5 text-sm font-bold"
              >
                <span>#{s.id.slice(0, 6)}</span>
                <span>{s.category}</span>
                <span>{s.address}</span>
                <span className="text-danger">
                  волна {s.wave} · {formatSeconds(s.waitingSeconds)}
                </span>
                <Link
                  href={`/orders/${s.id}`}
                  className="rounded-pill bg-primary px-3 py-1.5 text-center text-xs font-extrabold text-white"
                >
                  Перейти к заказу
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
