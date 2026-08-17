import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, Badge, EmptyState, Table, WalletIcon } from '@masterqala/ui';
import type { BadgeTone } from '@masterqala/ui';
import { api } from '../api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'danger',
};

interface Row {
  id: string;
  amount: number;
  status: string;
  requestedAt: string;
  master: { phone: string };
}

export default function AdminWithdrawalsPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api('/admin/withdrawals').then(setRows);
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
        <ArrowLeftIcon size={16} />К заявкам мастеров
      </Link>
      <h1 className="text-2xl font-bold text-ink">Заявки на вывод</h1>
      <Table<Row>
        caption="Заявки мастеров на вывод средств"
        className="rounded-lg border border-border bg-surface"
        columns={[
          {
            key: 'master',
            header: 'Мастер',
            cell: (row) => <span className="font-semibold">···{row.master.phone}</span>,
          },
          {
            key: 'amount',
            header: 'Сумма',
            align: 'right',
            cell: (row) => `${row.amount} ₸`,
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
            key: 'requestedAt',
            header: 'Дата',
            hideBelow: 'sm',
            cell: (row) => new Date(row.requestedAt).toLocaleDateString('ru-RU'),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={<WalletIcon size={32} />}
            title="Пусто"
            subtitle="Заявок на вывод средств пока нет."
          />
        }
      />
    </div>
  );
}
