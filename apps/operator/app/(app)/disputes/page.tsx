'use client';
import { useEffect, useState } from 'react';
import {
  fetchDisputes,
  fetchDispute,
  resolveDispute,
  DISPUTE_STATUS_LABELS,
  DISPUTE_ROLE_LABELS,
  type DisputeListRow,
  type DisputeDetail,
  type DisputeStatus,
} from '@/lib/disputes';
import { fetchOrder, type OrderDetail, type OrderType } from '@/lib/orders';
import { Lightbox } from '@/components/Lightbox';
import { useOperatorMetrics } from '@/lib/operatorMetrics';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/api';

const STATUS_FILTERS: { value: DisputeStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все' },
  { value: 'OPEN', label: 'открытые' },
  { value: 'RESOLVED', label: 'разрешённые' },
];

const STATUS_PILL: Record<DisputeStatus, string> = {
  OPEN: 'bg-warning-bg text-warning-ink',
  RESOLVED: 'bg-success-bg text-success-ink',
};

function formatWaiting(createdAt: string): string {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  return hours < 24 ? `ждёт ${hours} ч` : `ждёт ${Math.floor(hours / 24)} дн`;
}


export default function DisputesPage() {
  const { refetch: refetchMetrics } = useOperatorMetrics();
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'ALL'>('OPEN');
  const [rows, setRows] = useState<DisputeListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DisputeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [order, setOrder] = useState<OrderDetail | null>(null);

  const [refundServiceFee, setRefundServiceFee] = useState(false);
  const [penalizeMaster, setPenalizeMaster] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [refundWarning, setRefundWarning] = useState('');
  const [openDoc, setOpenDoc] = useState<{ id: string; title: string } | null>(null);

  function loadList() {
    setListLoading(true);
    fetchDisputes(statusFilter === 'ALL' ? undefined : statusFilter)
      .then((data) => {
        setRows(data);
        setListError('');
      })
      .catch((e) => setListError((e as Error).message))
      .finally(() => setListLoading(false));
  }

  useEffect(loadList, [statusFilter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setOrder(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setRefundServiceFee(false);
    setPenalizeMaster(false);
    setResolutionNote('');
    setConfirming(false);
    setResolveError('');
    setRefundWarning('');
    setOrder(null);

    fetchDispute(selectedId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setDetailError('');
        const orderType: OrderType = data.orderId ? 'urgent' : 'planned';
        const orderId = data.orderId ?? data.plannedOrderId;
        if (orderId) {
          fetchOrder(orderId, orderType)
            .then((o) => {
              if (!cancelled) setOrder(o);
            })
            .catch(() => {
              /* контекст заказа необязателен — деталь спора работает и без него */
            });
        }
      })
      .catch((e) => {
        if (!cancelled) setDetailError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function confirmResolve() {
    if (!selectedId) return;
    setResolving(true);
    setResolveError('');
    setRefundWarning('');
    try {
      const updated = await resolveDispute(selectedId, {
        refundServiceFee,
        penalizeMaster,
        resolutionNote: resolutionNote.trim(),
      });
      setDetail(updated);
      setConfirming(false);
      loadList();
      refetchMetrics();
    } catch (e) {
      const message = (e as Error).message;
      // 503 = «спор разрешён, но возврат сбора не удался» — специфичный для этого
      // случая статус на бэкенде (disputes.service.ts), а не текст сообщения,
      // который мог бы измениться и молча сломать эту ветку.
      if (e instanceof ApiError && e.status === 503) {
        setRefundWarning(message);
        setConfirming(false);
        try {
          const refreshed = await fetchDispute(selectedId);
          setDetail(refreshed);
        } catch {
          /* деталь уже была разрешена на бэкенде — покажем предупреждение как есть */
        }
        loadList();
        refetchMetrics();
      } else {
        setResolveError(message);
      }
    } finally {
      setResolving(false);
    }
  }

  const canRefundServiceFee = Boolean(detail?.orderId && detail.commercialMode !== 'FREE_PILOT');
  const needComment = !resolutionNote.trim();

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Споры</div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DisputeStatus | 'ALL')}
          className="rounded-md border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {listError && <div className="text-sm text-danger">{listError}</div>}

      <div className="flex gap-4">
        <div className="flex w-[300px] shrink-0 flex-col gap-2">
          {listLoading && <div className="text-sm text-ink-soft">Загрузка…</div>}
          {!listLoading && rows.length === 0 && <div className="text-sm text-ink-soft">Пусто</div>}
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={`rounded-lg border-2 bg-surface p-3 text-left ${
                selectedId === r.id ? 'border-primary' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-ink">
                  #{r.id.slice(0, 8)} · {r.orderId ? 'Срочная' : 'Плановая'}
                </span>
                <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold ${STATUS_PILL[r.status]}`}>
                  {DISPUTE_STATUS_LABELS[r.status]}
                </span>
              </div>
              <div className="mt-1 text-xs font-semibold text-ink-soft">
                открыл {DISPUTE_ROLE_LABELS[r.openedByRole]} · {formatWaiting(r.createdAt)}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 rounded-lg border border-border bg-surface p-5">
          {!selectedId && <div className="text-sm text-ink-soft">Выберите спор слева</div>}
          {selectedId && detailLoading && <div className="text-sm text-ink-soft">Загрузка…</div>}
          {selectedId && detailError && <div className="text-sm text-danger">{detailError}</div>}
          {selectedId && !detailLoading && detail && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-extrabold text-ink">
                  Спор по {detail.orderId ? 'срочной' : 'плановой'} заявке
                </span>
                <span className={`rounded-pill px-3 py-1 text-xs font-extrabold ${STATUS_PILL[detail.status]}`}>
                  {DISPUTE_STATUS_LABELS[detail.status]}
                </span>
              </div>

              {order && (
                <>
                  <div className="text-sm text-ink-soft">
                    {order.category} · {order.address}, {order.district}
                  </div>
                  <div className="text-sm font-extrabold text-ink">Таймлайн заказа</div>
                  <div className="flex flex-col gap-2">
                    {order.timeline.map((event, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="text-ink-soft">{formatDateTime(event.at)}</span>
                        <span className="font-bold text-ink">{event.event}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="rounded-md bg-fill-soft p-3">
                <div className="text-[10px] font-bold uppercase text-ink-soft">
                  Заявление ({DISPUTE_ROLE_LABELS[detail.openedByRole]})
                </div>
                <div className="mt-1 text-sm text-ink">{detail.reason}</div>
              </div>

              {detail.evidenceDocIds.length > 0 && (
                <>
                  <div className="text-sm font-extrabold text-ink">Доказательства</div>
                  <div className="flex flex-wrap gap-2.5">
                    {detail.evidenceDocIds.map((docId, i) => (
                      <button
                        key={docId}
                        type="button"
                        onClick={() => setOpenDoc({ id: docId, title: `Доказательство ${i + 1}` })}
                        className="rounded-md border border-border bg-fill-faint px-3 py-2 text-xs font-extrabold text-ink"
                      >
                        Фото {i + 1} · открыть ⤢
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="rounded-md bg-fill-soft p-3">
                <div className="text-[10px] font-bold uppercase text-ink-soft">Пояснение второй стороны</div>
                <div className="mt-1 text-sm text-ink">{detail.counterStatement ?? 'пояснение не предоставлено'}</div>
              </div>

              {detail.status !== 'OPEN' ? (
                <div className="rounded-md bg-fill-soft p-3 text-sm font-bold text-ink">
                  ✓ Решено: {detail.refundServiceFee && 'сбор возвращён'}
                  {detail.refundServiceFee && detail.penalizeMaster && ', '}
                  {detail.penalizeMaster && 'мастер оштрафован'}
                  {!detail.refundServiceFee && !detail.penalizeMaster && 'без возврата и без санкции'}
                  {detail.resolutionNote && <div className="mt-1 text-xs font-semibold text-ink-soft">{detail.resolutionNote}</div>}
                  {detail.resolvedAt && (
                    <div className="mt-1 text-xs font-semibold text-ink-soft">{formatDateTime(detail.resolvedAt)}</div>
                  )}
                  {refundWarning && <div className="mt-2 text-xs font-extrabold text-danger">{refundWarning}</div>}
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                  <div className="text-sm font-extrabold text-ink">Решение оператора</div>

                  {canRefundServiceFee ? (
                    <label className="flex items-center gap-2 text-sm font-bold text-ink">
                      <input
                        type="checkbox"
                        checked={refundServiceFee}
                        onChange={(e) => setRefundServiceFee(e.target.checked)}
                      />
                      Вернуть сервисный сбор клиенту
                    </label>
                  ) : detail.orderId ? (
                    <div className="rounded-md bg-fill-faint p-2 text-xs text-ink-soft">
                      В бесплатном пилоте сервисный сбор не взимался, возврат недоступен.
                    </div>
                  ) : null}

                  <label className="flex items-center gap-2 text-sm font-bold text-ink">
                    <input
                      type="checkbox"
                      checked={penalizeMaster}
                      onChange={(e) => setPenalizeMaster(e.target.checked)}
                    />
                    Санкция мастеру
                  </label>

                  <textarea
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Комментарий решения — обязателен, увидят обе стороны"
                    className="min-h-16 rounded-md border-[1.5px] border-border bg-fill-faint p-3 text-sm"
                  />

                  {!confirming ? (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={needComment}
                        onClick={() => setConfirming(true)}
                        className="rounded-pill bg-primary px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
                      >
                        Решить спор
                      </button>
                      {needComment && (
                        <span className="text-xs font-bold text-warning-ink">введите комментарий решения</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-md bg-warning-bg p-3">
                      <div className="text-xs font-bold text-warning-ink">
                        Подтвердите: {refundServiceFee && 'сбор будет возвращён'}
                        {refundServiceFee && penalizeMaster && ', '}
                        {penalizeMaster && 'мастер получит санкцию'}
                        {!refundServiceFee && !penalizeMaster && 'решение без возврата и без санкции'}.
                        Действие необратимо и попадёт в журнал.
                      </div>
                      {resolveError && <div className="text-xs font-bold text-danger">{resolveError}</div>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={resolving}
                          onClick={confirmResolve}
                          className="rounded-pill bg-danger px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
                        >
                          Подтверждаю решение
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
          )}
        </div>
      </div>

      {openDoc && selectedId && (
        <Lightbox
          path={`/disputes/${selectedId}/evidence/${encodeURIComponent(openDoc.id)}`}
          title={openDoc.title}
          onClose={() => setOpenDoc(null)}
        />
      )}
    </div>
  );
}
