import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, EmptyState, Select, ShieldIcon, Table, UsersIcon } from '@masterqala/ui';
import { api } from '../api';

interface Row {
  id: string;
  fullName: string;
  district: string;
  status: string;
  createdAt: string;
  user: { phone: string };
  categories: { category: { name: string } }[];
}

const STATUSES = [
  { value: 'PENDING_REVIEW', label: 'На проверке' },
  { value: 'NEEDS_INFO', label: 'Нужны данные' },
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'REJECTED', label: 'Отклонённые' },
];

export default function AdminListPage() {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api(`/admin/applications?status=${status}`).then(setRows);
  }, [status]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
        <ArrowLeftIcon size={16} />Назад
      </Link>
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-ink">Заявки мастеров</h1>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link to="/admin/withdrawals" className="text-primary underline">
            Заявки на вывод
          </Link>
          <Link to="/admin/disputes" className="text-primary underline">
            Споры
          </Link>
          <Link
            to="/admin/security"
            className="inline-flex items-center gap-1.5 font-bold text-danger underline"
          >
            <ShieldIcon size={16} />
            Безопасность
          </Link>
        </nav>
      </div>
      <Select
        label="Статус заявки"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        fieldClassName="max-w-xs"
      >
        {STATUSES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
      <Table<Row>
        caption="Заявки мастеров на подключение"
        className="rounded-lg border border-border bg-surface"
        columns={[
          {
            key: 'fullName',
            header: 'Мастер',
            cell: (row) => (
              <Link to={`/admin/${row.id}`} className="font-semibold text-primary underline">
                {row.fullName}
              </Link>
            ),
          },
          { key: 'phone', header: 'Телефон', cell: (row) => row.user.phone },
          { key: 'district', header: 'Район', hideBelow: 'sm', cell: (row) => row.district },
          {
            key: 'categories',
            header: 'Категории',
            hideBelow: 'md',
            cell: (row) => row.categories.map((category) => category.category.name).join(', '),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={<UsersIcon size={32} />}
            title="Пусто"
            subtitle="Заявок с выбранным статусом нет."
          />
        }
      />
    </div>
  );
}
