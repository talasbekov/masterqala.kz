'use client';
import { useEffect, useState } from 'react';
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

const STATUS_PILL: Record<WithdrawalStatus, string> = {
  PENDING: 'bg-warning-bg text-warning-ink',
  PAID: 'bg-success-bg text-success-ink',
  FAILED: 'bg-danger-bg text-danger',
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

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Вывод средств</div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WithdrawalStatus | 'ALL')}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}

      <div className="rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[1fr_160px_140px_160px_160px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
          <span>Мастер</span>
          <span>Реквизиты</span>
          <span>Сумма</span>
          <span>Дата</span>
          <span>Статус</span>
        </div>
        {loading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
        {!loading && filtered.length === 0 && <div className="p-4 text-sm text-ink-soft">Ничего не найдено</div>}
        {filtered.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1fr_160px_140px_160px_160px] items-center gap-3 border-b border-fill-soft px-4 py-2.5 text-sm font-bold"
          >
            <span className="text-ink-soft">{r.masterUserId.slice(0, 8)}</span>
            <span>{formatMaskedPhone(r.master.phone)}</span>
            <span>{r.amount} ₸</span>
            <span className="text-ink-soft">{formatDate(r.paidAt ?? r.requestedAt)}</span>
            <span>
              <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold ${STATUS_PILL[r.status]}`}>
                {STATUS_LABELS[r.status]}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="text-xs text-ink-soft">
        Выплаты проходят автоматически через платёжного провайдера; при отказе банка сумма возвращается на баланс
        мастера. Раздел read-only.
      </div>
    </div>
  );
}
