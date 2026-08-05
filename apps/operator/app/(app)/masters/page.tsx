'use client';
import { useEffect, useState } from 'react';
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

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Мастера</div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          <option value="">все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder="Район (точное совпадение)"
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        />
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[1fr_170px_100px_100px_180px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
          <span>Мастер</span>
          <span>Категории</span>
          <span>Рейтинг</span>
          <span>Заказов</span>
          <span>Статус</span>
        </div>
        {loading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
        {!loading && rows.length === 0 && <div className="p-4 text-sm text-ink-soft">Ничего не найдено</div>}
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_170px_100px_100px_180px] items-center gap-3 border-b border-fill-soft px-4 py-2.5 text-sm font-bold"
          >
            <span>{row.name ?? '—'}</span>
            <span className="text-ink-soft">{row.categories.join(', ')}</span>
            <span>{row.rating === null ? '—' : `★ ${row.rating.toFixed(1)}`}</span>
            <span>{row.orders}</span>
            <span className="text-ink-soft">{row.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
