'use client';
import { useEffect, useState } from 'react';
import { fetchJournal, ACTION_LABELS, type AuditLogRow } from '@/lib/journal';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return isToday ? `сегодня ${time}` : `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} ${time}`;
}

function whoLabel(row: AuditLogRow): string {
  if (row.actorType === 'SYSTEM' || !row.actor) return 'система';
  return row.actor.name ?? row.actor.phone;
}

function whatLabel(row: AuditLogRow): string {
  const label = ACTION_LABELS[row.action] ?? row.action;
  return row.comment ? `${label}: ${row.comment}` : label;
}

export default function JournalPage() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchJournal(page)
      .then((data) => {
        setRows(data.rows);
        setTotal(data.total);
        setPageSize(data.pageSize);
        setError('');
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [page]);

  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="text-2xl font-extrabold text-ink">Журнал</div>
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[130px_170px_1fr] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
          <span>Время</span>
          <span>Кто</span>
          <span>Что</span>
        </div>
        {loading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
        {!loading && rows.length === 0 && <div className="p-4 text-sm text-ink-soft">Пусто</div>}
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[130px_170px_1fr] items-start gap-3 border-b border-fill-soft px-4 py-2.5 text-sm font-bold"
          >
            <span className="text-ink-soft">{formatWhen(row.createdAt)}</span>
            <span>{whoLabel(row)}</span>
            <span className="text-ink-soft">{whatLabel(row)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-pill border-[1.5px] border-border px-3 py-1 text-xs font-extrabold text-ink-soft disabled:opacity-40"
        >
          ‹ Назад
        </button>
        <span className="text-xs font-bold text-ink-soft">
          Стр. {page} из {lastPage}
        </span>
        <button
          type="button"
          disabled={page >= lastPage}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-pill border-[1.5px] border-border px-3 py-1 text-xs font-extrabold text-ink-soft disabled:opacity-40"
        >
          Вперёд ›
        </button>
      </div>
    </div>
  );
}
