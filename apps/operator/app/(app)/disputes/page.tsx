'use client';
import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  PhotoIcon,
  Select,
  Skeleton,
  SkeletonList,
  type BadgeTone,
} from '@masterqala/ui';
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
import { DisputeResolution } from '@/components/DisputeResolution';
import { useOperatorMetrics } from '@/lib/operatorMetrics';
import { formatDateTime } from '@/lib/format';
import { ApiError } from '@/lib/api';

const STATUS_FILTERS: { value: DisputeStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все' },
  { value: 'OPEN', label: 'открытые' },
  { value: 'RESOLVED', label: 'разрешённые' },
];

const STATUS_TONE: Record<DisputeStatus, BadgeTone> = {
  OPEN: 'warning',
  RESOLVED: 'success',
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

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <h1 className="text-2xl font-extrabold text-ink">Споры</h1>
      <Select
        label="Статус спора"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as DisputeStatus | 'ALL')}
        fieldClassName="w-full sm:w-64"
      >
        {STATUS_FILTERS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      {listError && <Alert tone="danger">{listError}</Alert>}

      {/* Ниже lg колонки складываются — иначе на 1024px список и деталь не
          помещаются рядом с меню. */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full shrink-0 lg:w-72">
          {listLoading ? (
            <SkeletonList rows={4} label="Загрузка списка споров" />
          ) : rows.length === 0 ? (
            <EmptyState title="Пусто" subtitle="Споров с таким статусом нет." />
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    aria-current={selectedId === r.id ? 'true' : undefined}
                    className={`w-full rounded-lg border-2 bg-surface p-3 text-left transition-colors duration-(--duration-fast) ease-(--ease-out) ${
                      selectedId === r.id ? 'border-primary' : 'border-border hover:border-border-strong'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-ink">
                        #{r.id.slice(0, 8)} · {r.orderId ? 'Срочная' : 'Плановая'}
                      </span>
                      <Badge tone={STATUS_TONE[r.status]}>{DISPUTE_STATUS_LABELS[r.status]}</Badge>
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-ink-soft">
                      открыл {DISPUTE_ROLE_LABELS[r.openedByRole]} · {formatWaiting(r.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <section
          aria-label="Карточка спора"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-5"
        >
          {!selectedId && <p className="text-sm text-ink-soft">Выберите спор в списке</p>}
          {selectedId && detailLoading && (
            <div role="status" aria-busy="true" className="flex flex-col gap-2">
              <span className="sr-only">Загрузка карточки спора</span>
              <Skeleton shape="text" className="w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          {selectedId && detailError && <Alert tone="danger">{detailError}</Alert>}
          {selectedId && !detailLoading && detail && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-ink">
                  Спор по {detail.orderId ? 'срочной' : 'плановой'} заявке
                </h2>
                <Badge tone={STATUS_TONE[detail.status]}>{DISPUTE_STATUS_LABELS[detail.status]}</Badge>
              </div>

              {order && (
                <>
                  <p className="text-sm text-ink-soft">
                    {order.category} · {order.address}, {order.district}
                  </p>
                  <h3 className="text-sm font-extrabold text-ink">Таймлайн заказа</h3>
                  <ul className="flex flex-col gap-2">
                    {order.timeline.map((event, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        <span className="text-ink-soft">{formatDateTime(event.at)}</span>
                        <span className="font-bold text-ink">{event.event}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="rounded-md bg-fill-soft p-3">
                <h3 className="text-2xs font-bold uppercase text-ink-soft">
                  Заявление ({DISPUTE_ROLE_LABELS[detail.openedByRole]})
                </h3>
                <p className="mt-1 text-sm text-ink">{detail.reason}</p>
              </div>

              {detail.evidenceDocIds.length > 0 && (
                <>
                  <h3 className="text-sm font-extrabold text-ink">Доказательства</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {detail.evidenceDocIds.map((docId, i) => (
                      <Button
                        key={docId}
                        variant="secondary"
                        size="sm"
                        icon={<PhotoIcon size={16} />}
                        onClick={() => setOpenDoc({ id: docId, title: `Доказательство ${i + 1}` })}
                      >
                        Фото {i + 1}
                      </Button>
                    ))}
                  </div>
                </>
              )}

              <div className="rounded-md bg-fill-soft p-3">
                <h3 className="text-2xs font-bold uppercase text-ink-soft">Пояснение второй стороны</h3>
                <p className="mt-1 text-sm text-ink">
                  {detail.counterStatement ?? 'пояснение не предоставлено'}
                </p>
              </div>

              {detail.status !== 'OPEN' ? (
                <Alert tone={refundWarning ? 'warning' : 'success'} title="Спор решён">
                  <p>
                    {detail.refundServiceFee && 'сбор возвращён'}
                    {detail.refundServiceFee && detail.penalizeMaster && ', '}
                    {detail.penalizeMaster && 'мастер оштрафован'}
                    {!detail.refundServiceFee && !detail.penalizeMaster &&
                      'без возврата и без санкции'}
                  </p>
                  {detail.resolutionNote && (
                    <p className="mt-1 text-xs font-semibold">{detail.resolutionNote}</p>
                  )}
                  {detail.resolvedAt && (
                    <p className="mt-1 text-xs font-semibold">{formatDateTime(detail.resolvedAt)}</p>
                  )}
                  {refundWarning && <p className="mt-2 text-xs font-extrabold">{refundWarning}</p>}
                </Alert>
              ) : (
                <DisputeResolution
                  canRefundServiceFee={canRefundServiceFee}
                  hasOrder={Boolean(detail.orderId)}
                  refundServiceFee={refundServiceFee}
                  onRefundChange={setRefundServiceFee}
                  penalizeMaster={penalizeMaster}
                  onPenalizeChange={setPenalizeMaster}
                  resolutionNote={resolutionNote}
                  onNoteChange={setResolutionNote}
                  confirming={confirming}
                  onStartConfirm={() => setConfirming(true)}
                  onCancelConfirm={() => setConfirming(false)}
                  resolving={resolving}
                  resolveError={resolveError}
                  onConfirm={confirmResolve}
                />
              )}
            </div>
          )}
        </section>
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
