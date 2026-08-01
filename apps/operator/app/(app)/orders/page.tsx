'use client';
import { useEffect, useRef, useState } from 'react';
import {
  fetchOrders,
  fetchOrder,
  fetchCandidates,
  assignMaster,
  statusLabel,
  statusPillClass,
  STATUS_LABELS,
  PLANNED_STATUS_LABELS,
  TYPE_LABELS,
  type OrderListRow,
  type OrderDetail,
  type OrderType,
  type AssignCandidate,
} from '@/lib/orders';
import { useOperatorMetrics } from '@/lib/operatorMetrics';
import { formatDateTime } from '@/lib/format';

const TYPE_FILTERS: { value: OrderType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все типы' },
  { value: 'urgent', label: 'срочные' },
  { value: 'planned', label: 'плановые' },
];

function statusOptionsFor(type: OrderType | 'ALL'): { value: string; label: string }[] {
  if (type === 'urgent') return Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
  if (type === 'planned') return Object.entries(PLANNED_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  const merged = new Map<string, string>();
  Object.entries(STATUS_LABELS).forEach(([value, label]) => merged.set(value, label));
  Object.entries(PLANNED_STATUS_LABELS).forEach(([value, label]) => merged.set(value, label));
  return Array.from(merged.entries()).map(([value, label]) => ({ value, label }));
}

export default function OrdersPage() {
  const { refetch: refetchMetrics } = useOperatorMetrics();
  const [typeFilter, setTypeFilter] = useState<OrderType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState<{ id: string; type: OrderType } | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [candidates, setCandidates] = useState<AssignCandidate[] | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState(false);

  function loadList() {
    setListLoading(true);
    fetchOrders({
      type: typeFilter === 'ALL' ? undefined : typeFilter,
      status: statusFilter || undefined,
      search: search.trim() || undefined,
    })
      .then((data) => {
        setRows(data);
        setListError('');
      })
      .catch((e) => setListError((e as Error).message))
      .finally(() => setListLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(loadList, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, search]);

  useEffect(() => {
    setStatusFilter('');
  }, [typeFilter]);

  const selectedRef = useRef<{ id: string; type: OrderType } | null>(null);
  selectedRef.current = selected;

  function loadDetail(target: { id: string; type: OrderType }) {
    setDetailLoading(true);
    fetchOrder(target.id, target.type)
      .then((data) => {
        if (selectedRef.current?.id !== target.id) return; // ответ на уже сброшенный выбор
        setDetail(data);
        setDetailError('');
      })
      .catch((e) => {
        if (selectedRef.current?.id !== target.id) return;
        setDetailError((e as Error).message);
      })
      .finally(() => {
        if (selectedRef.current?.id === target.id) setDetailLoading(false);
      });
  }

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    loadDetail(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function openAssignModal() {
    if (!selected) return;
    setAssignOpen(true);
    setAssignError('');
    setCandidates(null);
    setCandidatesLoading(true);
    try {
      const data = await fetchCandidates(selected.id);
      setCandidates(data);
    } catch (e) {
      setAssignError((e as Error).message);
    } finally {
      setCandidatesLoading(false);
    }
  }

  async function confirmAssign(masterUserId: string) {
    if (!selected) return;
    setAssigning(true);
    setAssignError('');
    try {
      await assignMaster(selected.id, masterUserId);
      setAssignOpen(false);
      setCandidates(null);
      loadDetail(selected);
      loadList();
      refetchMetrics();
    } catch (e) {
      setAssignError((e as Error).message);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Заказы</div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as OrderType | 'ALL')}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          {TYPE_FILTERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          <option value="">все статусы</option>
          {statusOptionsFor(typeFilter).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по ID заказа или телефону клиента"
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        />
      </div>
      {listError && <div className="text-sm text-danger">{listError}</div>}

      <div className="flex gap-4">
        <div className="flex-1 rounded-lg border border-border bg-surface">
          <div className="grid grid-cols-[100px_90px_1fr_1fr_140px_160px] gap-3 border-b border-fill-soft px-4 py-2 text-[11px] font-extrabold uppercase text-ink-soft">
            <span>ID</span>
            <span>Тип</span>
            <span>Клиент</span>
            <span>Мастер</span>
            <span>Категория</span>
            <span>Статус</span>
          </div>
          {listLoading && <div className="p-4 text-sm text-ink-soft">Загрузка…</div>}
          {!listLoading && rows.length === 0 && <div className="p-4 text-sm text-ink-soft">Ничего не найдено</div>}
          {rows.map((row) => (
            <button
              key={`${row.type}-${row.id}`}
              type="button"
              onClick={() => setSelected({ id: row.id, type: row.type })}
              className={`grid w-full grid-cols-[100px_90px_1fr_1fr_140px_160px] items-center gap-3 border-b border-fill-soft px-4 py-2.5 text-left text-sm font-bold ${
                selected?.id === row.id ? 'bg-fill-soft' : 'bg-transparent'
              }`}
            >
              <span className="truncate text-ink-soft">{row.id.slice(0, 8)}</span>
              <span>{TYPE_LABELS[row.type]}</span>
              <span className="truncate">{row.client}</span>
              <span className="truncate text-ink-soft">{row.master ?? '—'}</span>
              <span className="truncate text-ink-soft">{row.category}</span>
              <span>
                <span
                  className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold ${statusPillClass(row.type, row.status)}`}
                >
                  {statusLabel(row.type, row.status)}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="w-[400px] shrink-0 rounded-lg border border-border bg-surface p-5">
          {!selected && <div className="text-sm text-ink-soft">Выберите заказ слева</div>}
          {selected && detailLoading && <div className="text-sm text-ink-soft">Загрузка…</div>}
          {selected && detailError && <div className="text-sm text-danger">{detailError}</div>}
          {selected && !detailLoading && detail && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-extrabold text-ink">
                  #{detail.id.slice(0, 8)} · {detail.category}
                </span>
                <span
                  className={`rounded-pill px-3 py-1 text-xs font-extrabold ${statusPillClass(detail.type, detail.status)}`}
                >
                  {statusLabel(detail.type, detail.status)}
                </span>
              </div>

              <div className="text-sm text-ink-soft">
                {detail.address} · {detail.district}
              </div>
              <div className="text-xs text-ink-soft">Создана {formatDateTime(detail.createdAt)}</div>

              <div className="rounded-md bg-fill-soft p-3">
                <div className="text-[10px] font-bold uppercase text-ink-soft">Платежи</div>
                {detail.type === 'urgent' ? (
                  <div className="mt-1 text-sm font-extrabold text-ink">
                    Выезд {detail.calloutPrice} ₸ · Сбор {detail.serviceFee} ₸
                    {detail.workPrice !== null && <> · Работа {detail.workPrice} ₸</>}
                  </div>
                ) : (
                  <div className="mt-1 text-sm font-extrabold text-ink">
                    Бюджет {detail.budget ?? '—'} ₸
                    {detail.workPrice !== null && <> · Работа {detail.workPrice} ₸</>}
                  </div>
                )}
              </div>

              <div className="text-sm font-extrabold text-ink">Клиент</div>
              <div className="text-sm text-ink-soft">
                {detail.client.name ?? detail.client.phone} · {detail.client.phone}
              </div>

              {detail.master && (
                <>
                  <div className="text-sm font-extrabold text-ink">Мастер</div>
                  <div className="text-sm text-ink-soft">
                    {detail.master.name ?? detail.master.phone} · {detail.master.phone}
                  </div>
                </>
              )}

              <div className="text-sm font-extrabold text-ink">Таймлайн</div>
              <div className="flex flex-col gap-2">
                {detail.timeline.map((event, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-ink-soft">{formatDateTime(event.at)}</span>
                    <span className="font-bold text-ink">{event.event}</span>
                  </div>
                ))}
              </div>

              {detail.canAssign && (
                <button
                  type="button"
                  onClick={openAssignModal}
                  className="rounded-pill bg-primary px-4 py-2 text-sm font-extrabold text-white"
                >
                  Назначить мастера вручную
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {assignOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
          onClick={() => setAssignOpen(false)}
        >
          <div className="w-full max-w-md rounded-lg bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-base font-extrabold text-ink">Выберите мастера</div>
            {candidatesLoading && <div className="text-sm text-ink-soft">Загрузка кандидатов…</div>}
            {assignError && <div className="mb-2 text-sm text-danger">{assignError}</div>}
            {!candidatesLoading && candidates && candidates.length === 0 && (
              <div className="text-sm text-ink-soft">Нет доступных кандидатов онлайн.</div>
            )}
            {!candidatesLoading && candidates && candidates.length > 0 && (
              <div className="flex flex-col gap-2">
                {candidates.map((c) => (
                  <div
                    key={c.masterUserId}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <span className="text-sm font-bold text-ink">
                      {c.name} · {c.distanceKm} км · {c.isOnline ? 'онлайн' : 'офлайн'}
                    </span>
                    <button
                      type="button"
                      disabled={assigning}
                      onClick={() => confirmAssign(c.masterUserId)}
                      className="rounded-pill bg-primary px-3 py-1 text-xs font-extrabold text-white disabled:opacity-40"
                    >
                      Назначить
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setAssignOpen(false)}
              className="mt-3 rounded-pill border-[1.5px] border-border px-4 py-2 text-sm font-extrabold text-ink-soft"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
