'use client';
import { useEffect, useState } from 'react';
import {
  fetchApplications,
  fetchApplication,
  decideApplication,
  documentIsViewable,
  DOCUMENT_TYPE_LABELS,
  MASTER_STATUS_LABELS,
  type ApplicationListItem,
  type ApplicationDetail,
  type MasterStatus,
  type DecisionType,
} from '@/lib/verification';
import { Lightbox } from '@/components/Lightbox';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

const STATUS_FILTERS: { value: MasterStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все статусы' },
  { value: 'PENDING_REVIEW', label: 'на проверке' },
  { value: 'NEEDS_INFO', label: 'нужны данные' },
  { value: 'ACTIVE', label: 'активен' },
  { value: 'REJECTED', label: 'отклонён' },
];

function formatWaiting(createdAt: string): string {
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  return hours < 24 ? `ждёт ${hours} ч` : `ждёт ${Math.floor(hours / 24)} дн`;
}

export default function VerificationPage() {
  const { refetch: refetchMetrics } = useOperatorMetrics();
  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<MasterStatus | 'ALL'>('ALL');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState('');
  const [openDoc, setOpenDoc] = useState<{ id: string; title: string } | null>(null);

  async function loadList() {
    try {
      const rows = await fetchApplications();
      setApplications(rows);
      setListError('');
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetchApplication(selectedId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setComment('');
        setDecideError('');
      })
      .catch((e) => {
        if (!cancelled) setListError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filtered = applications.filter((a) => statusFilter === 'ALL' || a.status === statusFilter);

  async function submitDecision(decision: DecisionType) {
    if (!selectedId) return;
    if (decision !== 'APPROVE' && !comment.trim()) return;
    setDeciding(true);
    setDecideError('');
    try {
      await decideApplication(selectedId, decision, comment.trim() || undefined);
      const [updated] = await Promise.all([fetchApplication(selectedId), loadList()]);
      setDetail(updated);
      setComment('');
      refetchMetrics();
    } catch (e) {
      setDecideError((e as Error).message);
    } finally {
      setDeciding(false);
    }
  }

  const needComment = !comment.trim();

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-extrabold text-ink">Верификация</div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as MasterStatus | 'ALL')}
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
          {!listLoading && filtered.length === 0 && <div className="text-sm text-ink-soft">Пусто</div>}
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedId(a.id)}
              className={`rounded-lg border-2 bg-surface p-3 text-left ${
                selectedId === a.id ? 'border-primary' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-ink">{a.fullName}</span>
                <span className="rounded-pill bg-fill-soft px-2 py-0.5 text-[10px] font-extrabold text-primary">
                  {MASTER_STATUS_LABELS[a.status]}
                </span>
              </div>
              <div className="mt-1 text-xs font-semibold text-ink-soft">
                {a.categories.map((c) => c.category.name).join(', ')} · {formatWaiting(a.createdAt)}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 rounded-lg border border-border bg-surface p-5">
          {!selectedId && <div className="text-sm text-ink-soft">Выберите анкету слева</div>}
          {selectedId && detailLoading && <div className="text-sm text-ink-soft">Загрузка…</div>}
          {selectedId && !detailLoading && detail && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-extrabold text-ink">
                  {detail.fullName} · ИИН {detail.iin}
                </span>
                <span className="rounded-pill bg-fill-soft px-3 py-1 text-xs font-extrabold text-primary">
                  {MASTER_STATUS_LABELS[detail.status]}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                <div className="rounded-md bg-fill-soft p-2.5">
                  <div className="text-[10px] font-bold text-ink-soft">Опыт</div>
                  <div className="text-sm font-extrabold text-ink">{detail.experienceYears} лет</div>
                </div>
                <div className="rounded-md bg-fill-soft p-2.5">
                  <div className="text-[10px] font-bold text-ink-soft">Категории</div>
                  <div className="text-sm font-extrabold text-ink">
                    {detail.categories.map((c) => c.category.name).join(', ')}
                  </div>
                </div>
                <div className="rounded-md bg-fill-soft p-2.5">
                  <div className="text-[10px] font-bold text-ink-soft">Геозона</div>
                  <div className="text-sm font-extrabold text-ink">{detail.district}</div>
                </div>
                <div className="rounded-md bg-fill-soft p-2.5">
                  <div className="text-[10px] font-bold text-ink-soft">Телефон</div>
                  <div className="text-sm font-extrabold text-ink">
                    +7 ··· {detail.user.phone.replace(/\D/g, '').slice(-4)}
                  </div>
                </div>
              </div>

              <div className="text-sm font-extrabold text-ink">Документы</div>
              <div className="flex flex-wrap gap-2.5">
                {detail.documents.map((doc) => {
                  const viewable = documentIsViewable(doc);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      disabled={!viewable}
                      onClick={() =>
                        setOpenDoc({
                          id: doc.id,
                          title: DOCUMENT_TYPE_LABELS[doc.type],
                        })
                      }
                      className="flex w-[170px] flex-col gap-1 rounded-md border border-border bg-fill-faint p-2.5 text-left disabled:opacity-50"
                    >
                      <span className="text-xs font-extrabold text-ink">{DOCUMENT_TYPE_LABELS[doc.type]}</span>
                      <span className="text-[11px] text-ink-soft">
                        {viewable ? 'открыть ⤢' : `проверка: ${doc.scanStatus.toLowerCase()}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {detail.status !== 'PENDING_REVIEW' ? (
                <div className="rounded-md bg-fill-soft p-3 text-sm font-bold text-ink">
                  {detail.status === 'ACTIVE' && '✓ Мастер одобрен и активирован.'}
                  {detail.status === 'NEEDS_INFO' && '📎 Запрошены дополнительные данные.'}
                  {detail.status === 'REJECTED' && `✕ Заявка отклонена. ${detail.rejectionReason ?? ''}`}
                </div>
              ) : (
                <>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Комментарий решения — обязателен при отказе или запросе данных"
                    className="min-h-16 rounded-md border-[1.5px] border-border bg-fill-faint p-3 text-sm"
                  />
                  {decideError && <div className="text-sm text-danger">{decideError}</div>}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={deciding}
                      onClick={() => submitDecision('APPROVE')}
                      className="rounded-pill bg-success px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
                    >
                      Одобрить
                    </button>
                    <button
                      type="button"
                      disabled={deciding || needComment}
                      onClick={() => submitDecision('REQUEST_INFO')}
                      className="rounded-pill border-[1.5px] border-primary px-4 py-2 text-sm font-extrabold text-primary disabled:opacity-40"
                    >
                      Запросить данные
                    </button>
                    <button
                      type="button"
                      disabled={deciding || needComment}
                      onClick={() => submitDecision('REJECT')}
                      className="rounded-pill border-[1.5px] border-danger px-4 py-2 text-sm font-extrabold text-danger disabled:opacity-40"
                    >
                      Отклонить
                    </button>
                    {needComment && (
                      <span className="text-xs font-bold text-warning-ink">
                        для отказа/запроса нужен комментарий
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {openDoc && selectedId && (
        <Lightbox
          path={`/admin/applications/${selectedId}/documents/${openDoc.id}`}
          title={openDoc.title}
          onClose={() => setOpenDoc(null)}
        />
      )}
    </div>
  );
}
