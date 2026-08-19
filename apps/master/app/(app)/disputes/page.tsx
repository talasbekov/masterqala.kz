'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchMyDisputes, type DisputeSummary } from '@/lib/disputes';

const STATUS_LABEL: Record<DisputeSummary['status'], string> = {
  OPEN: 'Открыт',
  RESOLVED: 'Решён',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function DisputesListPage() {
  const [disputes, setDisputes] = useState<DisputeSummary[] | null>(null);

  useEffect(() => {
    fetchMyDisputes().then(setDisputes);
  }, []);

  if (disputes === null) return <div className="p-8 text-ink-soft">Загрузка…</div>;

  return (
    <div className="mx-auto max-w-[560px] p-6">
      <h1 className="mb-4 text-lg font-extrabold text-ink">Мои споры</h1>
      {disputes.length === 0 && <p className="text-sm text-ink-soft">У вас нет споров.</p>}
      <div className="space-y-2">
        {disputes.map((d) => (
          <Link
            key={d.id}
            href={`/disputes/${d.id}`}
            className="flex items-center justify-between rounded-md border border-border bg-surface p-4 hover:bg-fill-faint"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-ink">{d.reason}</div>
              <div className="mt-1 text-xs text-ink-soft">{formatDate(d.createdAt)}</div>
            </div>
            <span
              className={`ml-3 shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-extrabold ${
                d.status === 'OPEN' ? 'bg-warning-bg text-warning-ink' : 'bg-fill-soft text-ink-soft'
              }`}
            >
              {STATUS_LABEL[d.status]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
