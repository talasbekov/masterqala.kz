'use client';
import { useEffect, useState } from 'react';
import {
  Alert,
  Card,
  EmptyState,
  Input,
  Select,
  SkeletonList,
  StarIcon,
  Table,
  type TableColumn,
} from '@masterqala/ui';
import { fetchCategories, fetchMasters, type Category, type OperatorMasterRow } from '@/lib/masters';

export default function MastersPage() {
  const [category, setCategory] = useState('');
  const [district, setDistrict] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<OperatorMasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchMasters(category || undefined, district.trim() || undefined)
        .then((data) => {
          setRows(data);
          setError('');
        })
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [category, district]);

  const columns: TableColumn<OperatorMasterRow>[] = [
    { key: 'name', header: 'Мастер', cell: (row) => <span className="font-bold">{row.name ?? '—'}</span> },
    {
      key: 'categories',
      header: 'Категории',
      width: '200px',
      hideBelow: 'md',
      cell: (row) => <span className="text-ink-soft">{row.categories.join(', ')}</span>,
    },
    {
      key: 'rating',
      header: 'Рейтинг',
      width: '110px',
      cell: (row) =>
        row.rating === null ? (
          '—'
        ) : (
          <span className="inline-flex items-center gap-1">
            <StarIcon size={16} className="text-warning" />
            {row.rating.toFixed(1)}
          </span>
        ),
    },
    {
      key: 'orders',
      header: 'Заказов',
      width: '100px',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) => row.orders,
    },
    {
      key: 'status',
      header: 'Статус',
      width: '180px',
      cell: (row) => <span className="text-ink-soft">{row.status}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <h1 className="text-2xl font-extrabold text-ink">Мастера</h1>
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Категория"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          fieldClassName="w-full sm:w-64"
        >
          <option value="">все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          label="Район"
          hint="Точное совпадение"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder="Например, Алмалинский"
          fieldClassName="w-full sm:w-64"
        />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <SkeletonList rows={5} label="Загрузка списка мастеров" />
      ) : rows.length === 0 ? (
        <EmptyState title="Ничего не найдено" subtitle="Измените категорию или район." />
      ) : (
        <Card padding="none">
          <Table
            caption="Мастера: имя, категории, рейтинг, число заказов и статус"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
          />
        </Card>
      )}
    </div>
  );
}
