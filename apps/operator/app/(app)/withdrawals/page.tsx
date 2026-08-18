'use client';
import { useEffect, useState } from 'react';
import {
  fetchWithdrawals,
  resolveWithdrawal,
  STATUS_LABELS,
  formatMaskedPhone,
  type WithdrawalRow,
  type WithdrawalStatus,
} from '@/lib/withdrawals';
import { formatDateTime as formatDate } from '@/lib/format';

const STATUS_FILTERS: { value: WithdrawalStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все' },
  { value: 'ERROR', label: 'ошибка' },
  { value: 'PENDING', label: 'в обработке' },
  { value: 'PAID', label: 'выплачено' },
  { value: 'FAILED', label: 'отклонено' },
];

const STATUS_PILL: Record<WithdrawalStatus, string> = {
  PENDING: 'bg-warning-bg text-warning-ink',
  PAID: 'bg-success-bg text-success-ink',
  FAILED: 'bg-danger-bg text-danger',
  ERROR: 'bg-danger-bg text-danger',
};

export default function WithdrawalsPage() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'PAID' | 'FAILED' | null>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  function load() {
    setLoading(true);
    fetchWithdrawals()
      .then((data) => {
        setRows(data);
        setError('');
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function toggleRow(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setOutcome(null);
    setReference('');
    setNote('');
    setConfirming(false);
    setResolveError('');
  }

  async function confirmResolve(id: string) {
    if (!outcome) return;
    setResolving(true);
    setResolveError('');
    try {
      const updated = await resolveWithdrawal(id, { outcome, reference: reference.trim() || undefined, note: note.trim() });
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setExpandedId(null);
      setConfirming(false);
    } catch (e) {
      setResolveError((e as Error).message);
    } finally {
      setResolving(false);
    }
  }

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
        <div className="grid grid-cols-[1fr_160px_140px_160px_180px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
          <span>Мастер</span>
          <span>Реквизиты</span>
          <span>Сумма</span>
          <span>Дата</span>
          <span>Статус</span>
        </div>
        {loading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
        {!loading && filtered.length === 0 && <div className="p-4 text-sm text-ink-soft">Ничего не найдено</div>}
        {filtered.map((r) => (
          <div key={r.id} className="border-b border-fill-soft">
            <button
              type="button"
              onClick={() => toggleRow(r.id)}
              className={`grid w-full grid-cols-[1fr_160px_140px_160px_180px] items-center gap-3 px-4 py-2.5 text-left text-sm font-bold ${
                expandedId === r.id ? 'bg-fill-soft' : ''
              }`}
            >
              <span className="text-ink-soft">{r.masterUserId.slice(0, 8)}</span>
              <span>{formatMaskedPhone(r.payoutPhone)}</span>
              <span>{r.amount} ₸</span>
              <span className="text-ink-soft">{formatDate(r.paidAt ?? r.requestedAt)}</span>
              <span>
                <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold ${STATUS_PILL[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </span>
            </button>

            {expandedId === r.id && (
              <div className="flex flex-col gap-3 border-t border-fill-soft bg-fill-faint px-4 py-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-ink-soft">
                  <span>ID заявки: <span className="font-bold text-ink">{r.id}</span></span>
                  <span>Логин-телефон мастера: <span className="font-bold text-ink">{formatMaskedPhone(r.master.phone)}</span></span>
                  <span>Запрошено: <span className="font-bold text-ink">{formatDate(r.requestedAt)}</span></span>
                  {r.providerRef && (
                    <span>Референс провайдера: <span className="font-bold text-ink">{r.providerRef}</span></span>
                  )}
                </div>

                {r.status === 'ERROR' && r.errorMessage && (
                  <div className="rounded-md bg-danger-bg p-3 text-xs font-semibold text-danger">
                    Причина ошибки: {r.errorMessage}
                  </div>
                )}

                {r.status !== 'ERROR' ? (
                  <div className="text-xs text-ink-soft">
                    Заявка не требует сверки — раздел read-only для этого статуса.
                  </div>
                ) : !confirming ? (
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-extrabold text-ink">
                      Сверка по выписке Kaspi: деньги реально ушли мастеру?
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOutcome('PAID')}
                        className={`rounded-pill border-2 px-3 py-1.5 text-xs font-extrabold ${
                          outcome === 'PAID' ? 'border-success-ink bg-success-bg text-success-ink' : 'border-border text-ink-soft'
                        }`}
                      >
                        Да, ушли
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutcome('FAILED')}
                        className={`rounded-pill border-2 px-3 py-1.5 text-xs font-extrabold ${
                          outcome === 'FAILED' ? 'border-danger bg-danger-bg text-danger' : 'border-border text-ink-soft'
                        }`}
                      >
                        Нет, не ушли — вернуть на баланс
                      </button>
                    </div>
                    {outcome === 'PAID' && (
                      <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Референс из выписки Kaspi (необязательно)"
                        className="rounded-md border-[1.5px] border-border bg-surface p-2.5 text-sm"
                      />
                    )}
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Комментарий сверки — обязателен, попадёт в журнал"
                      className="min-h-16 rounded-md border-[1.5px] border-border bg-surface p-2.5 text-sm"
                    />
                    <div>
                      <button
                        type="button"
                        disabled={!outcome || !note.trim()}
                        onClick={() => setConfirming(true)}
                        className="rounded-pill bg-primary px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
                      >
                        Разрешить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 rounded-md bg-warning-bg p-3">
                    <div className="text-xs font-bold text-warning-ink">
                      Подтвердите: {outcome === 'PAID' ? 'заявка помечена выплаченной, баланс не меняется' : 'заявка отклонена, сумма вернётся на баланс мастера'}.
                      Действие необратимо и попадёт в журнал.
                    </div>
                    {resolveError && <div className="text-xs font-bold text-danger">{resolveError}</div>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={resolving}
                        onClick={() => confirmResolve(r.id)}
                        className="rounded-pill bg-danger px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
                      >
                        Подтверждаю
                      </button>
                      <button
                        type="button"
                        disabled={resolving}
                        onClick={() => setConfirming(false)}
                        className="rounded-pill border-[1.5px] border-border px-4 py-2 text-sm font-extrabold text-ink-soft"
                      >
                        Назад
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-ink-soft">
        Выплаты проходят автоматически через платёжного провайдера; при отказе банка сумма возвращается на баланс
        мастера. Заявки в статусе «ошибка» требуют ручной сверки по выписке Kaspi — остальное read-only.
      </div>
    </div>
  );
}
