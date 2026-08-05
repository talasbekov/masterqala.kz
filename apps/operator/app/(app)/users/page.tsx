'use client';
import { useEffect, useState } from 'react';
import { fetchUsers, blockUser, unblockUser, type OperatorUserRow } from '@/lib/users';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<OperatorUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blockTarget, setBlockTarget] = useState<OperatorUserRow | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load(currentSearch: string) {
    try {
      const data = await fetchUsers(currentSearch.trim() || undefined);
      setRows(data);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(search), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function confirmBlock() {
    if (!blockTarget || !reason.trim()) return;
    setSubmitting(true);
    try {
      await blockUser(blockTarget.id, reason.trim());
      setBlockTarget(null);
      setReason('');
      await load(search);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnblock(id: string) {
    try {
      await unblockUser(id);
      await load(search);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Пользователи</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по телефону/имени"
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        />
      </div>
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[1fr_170px_140px_100px_140px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
          <span>Пользователь</span>
          <span>Телефон</span>
          <span>Роль</span>
          <span>Заказов</span>
          <span></span>
        </div>
        {loading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
        {!loading && rows.length === 0 && <div className="p-4 text-sm text-ink-soft">Ничего не найдено</div>}
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_170px_140px_100px_140px] items-center gap-3 border-b border-fill-soft px-4 py-2.5 text-sm font-bold"
          >
            <span>
              {row.name ?? '—'}
              {row.isBlocked && (
                <span className="ml-2 rounded-pill bg-danger-bg px-2 py-0.5 text-[10px] font-extrabold text-danger">
                  заблокирован
                </span>
              )}
            </span>
            <span className="text-ink-soft">{row.phone}</span>
            <span>{row.role}</span>
            <span>{row.orders}</span>
            <span>
              {row.isBlocked ? (
                <button
                  type="button"
                  onClick={() => handleUnblock(row.id)}
                  className="rounded-pill border-[1.5px] border-success px-3 py-1 text-xs font-extrabold text-success"
                >
                  Разблокировать
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBlockTarget(row);
                    setReason('');
                  }}
                  className="rounded-pill border-[1.5px] border-danger px-3 py-1 text-xs font-extrabold text-danger"
                >
                  Заблокировать
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {blockTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
          onClick={() => setBlockTarget(null)}
        >
          <div className="w-full max-w-md rounded-lg bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-base font-extrabold text-ink">
              Заблокировать {blockTarget.name ?? blockTarget.phone}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Причина блокировки — обязательна"
              className="mb-3 min-h-20 w-full rounded-md border-[1.5px] border-border bg-fill-faint p-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmBlock}
                disabled={!reason.trim() || submitting}
                className="rounded-pill bg-danger px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
              >
                Подтвердить
              </button>
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="rounded-pill border-[1.5px] border-border px-4 py-2 text-sm font-extrabold text-ink-soft"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
