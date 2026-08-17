'use client';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  ChevronLeftIcon,
  ChevronRightIcon,
  EmptyState,
  SkeletonList,
  Table,
  type TableColumn,
} from '@masterqala/ui';
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

  const columns: TableColumn<AuditLogRow>[] = [
    {
      key: 'when',
      header: 'Время',
      width: '150px',
      cell: (row) => <span className="text-ink-soft">{formatWhen(row.createdAt)}</span>,
    },
    {
      key: 'who',
      header: 'Кто',
      width: '180px',
      hideBelow: 'md',
      cell: (row) => <span className="font-bold">{whoLabel(row)}</span>,
    },
    { key: 'what', header: 'Что', cell: (row) => <span className="text-ink-soft">{whatLabel(row)}</span> },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <h1 className="text-2xl font-extrabold text-ink">Журнал</h1>
      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <SkeletonList rows={6} label="Загрузка журнала действий" />
      ) : rows.length === 0 ? (
        <EmptyState title="Пусто" subtitle="За выбранную страницу записей нет." />
      ) : (
        <Card padding="none">
          <Table
            caption="Журнал действий: время, инициатор и событие"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
          />
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          icon={<ChevronLeftIcon size={16} />}
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Назад
        </Button>
        <span className="text-xs font-bold text-ink-soft" aria-live="polite">
          Стр. {page} из {lastPage}
        </span>
        <Button
          variant="secondary"
          size="sm"
          iconRight={<ChevronRightIcon size={16} />}
          disabled={page >= lastPage}
          onClick={() => setPage((p) => p + 1)}
        >
          Вперёд
        </Button>
      </div>
    </div>
  );
}
