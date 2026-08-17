'use client';
import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Select,
  SkeletonList,
  Table,
  type BadgeTone,
  type TableColumn,
} from '@masterqala/ui';
import {
  fetchWithdrawals,
  STATUS_LABELS,
  formatMaskedPhone,
  type WithdrawalRow,
  type WithdrawalStatus,
} from '@/lib/withdrawals';
import { formatDateTime as formatDate } from '@/lib/format';

const STATUS_FILTERS: { value: WithdrawalStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все' },
  { value: 'PENDING', label: 'в обработке' },
  { value: 'PAID', label: 'выплачено' },
  { value: 'FAILED', label: 'отклонено' },
];

const STATUS_TONE: Record<WithdrawalStatus, BadgeTone> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'danger',
};

export default function WithdrawalsPage() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWithdrawals()
      .then((data) => {
        setRows(data);
        setError('');
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => statusFilter === 'ALL' || r.status === statusFilter);

  const columns: TableColumn<WithdrawalRow>[] = [
    {
      key: 'master',
      header: 'Мастер',
      cell: (r) => <span className="text-ink-soft">{r.masterUserId.slice(0, 8)}</span>,
    },
    {
      key: 'requisites',
      header: 'Реквизиты',
      width: '170px',
      hideBelow: 'md',
      cell: (r) => formatMaskedPhone(r.master.phone),
    },
    {
      key: 'amount',
      header: 'Сумма',
      width: '140px',
      align: 'right',
      cell: (r) => <span className="font-bold">{r.amount} ₸</span>,
    },
    {
      key: 'date',
      header: 'Дата',
      width: '170px',
      hideBelow: 'lg',
      cell: (r) => <span className="text-ink-soft">{formatDate(r.paidAt ?? r.requestedAt)}</span>,
    },
    {
      key: 'status',
      header: 'Статус',
      width: '160px',
      cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <h1 className="text-2xl font-extrabold text-ink">Вывод средств</h1>
      <Select
        label="Статус заявки"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as WithdrawalStatus | 'ALL')}
        fieldClassName="w-full sm:w-64"
      >
        {STATUS_FILTERS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <SkeletonList rows={5} label="Загрузка заявок на вывод" />
      ) : filtered.length === 0 ? (
        <EmptyState title="Ничего не найдено" subtitle="Смените фильтр статуса." />
      ) : (
        <Card padding="none">
          <Table
            caption="Заявки на вывод средств: мастер, реквизиты, сумма, дата и статус"
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
          />
        </Card>
      )}

      <p className="text-xs text-ink-soft">
        Выплаты проходят автоматически через платёжного провайдера; при отказе банка сумма
        возвращается на баланс мастера. Раздел read-only.
      </p>
    </div>
  );
}
