import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, Badge, EmptyState, ScaleIcon, Select, Table } from '@masterqala/ui';
import type { BadgeTone } from '@masterqala/ui';
import { api } from '../api';

const STATUS_LABELS: Record<string, string> = { OPEN: 'Открыт', RESOLVED: 'Разрешён' };

const STATUS_TONES: Record<string, BadgeTone> = { OPEN: 'warning', RESOLVED: 'success' };

interface Row {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  openedByRole: string;
  status: string;
  createdAt: string;
}

export default function AdminDisputesPage() {
  const [status, setStatus] = useState('OPEN');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api(`/admin/disputes?status=${status}`).then(setRows);
  }, [status]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
        <ArrowLeftIcon size={16} />К заявкам мастеров
      </Link>
      <h1 className="text-2xl font-bold text-ink">Споры</h1>
      <Select
        label="Статус спора"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        fieldClassName="max-w-xs"
      >
        <option value="OPEN">Открытые</option>
        <option value="RESOLVED">Разрешённые</option>
      </Select>
      <Table<Row>
        caption="Споры по заявкам"
        className="rounded-lg border border-border bg-surface"
        columns={[
          {
            key: 'kind',
            header: 'Заявка',
            cell: (row) => (
              <Link to={`/admin/disputes/${row.id}`} className="font-semibold text-primary underline">
                {row.orderId ? 'Срочная' : 'Плановая'}
              </Link>
            ),
          },
          {
            key: 'openedBy',
            header: 'Открыл',
            cell: (row) => (row.openedByRole === 'CLIENT' ? 'клиент' : 'мастер'),
          },
          {
            key: 'status',
            header: 'Статус',
            cell: (row) => (
              <Badge tone={STATUS_TONES[row.status] ?? 'neutral'}>
                {STATUS_LABELS[row.status] ?? row.status}
              </Badge>
            ),
          },
          {
            key: 'createdAt',
            header: 'Дата',
            hideBelow: 'sm',
            cell: (row) => new Date(row.createdAt).toLocaleDateString('ru-RU'),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={<ScaleIcon size={32} />}
            title="Пусто"
            subtitle="Споров с выбранным статусом нет."
          />
        }
      />
    </div>
  );
}
