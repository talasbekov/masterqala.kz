'use client';
import { Alert, Badge, Button, Skeleton, Textarea, PhotoIcon } from '@masterqala/ui';
import {
  DOCUMENT_TYPE_LABELS,
  MASTER_STATUS_LABELS,
  documentIsViewable,
  type ApplicationDetail as Application,
  type DecisionType,
  type MasterStatus,
} from '@/lib/verification';

const STATUS_TONE: Record<MasterStatus, 'neutral' | 'primary' | 'success' | 'danger' | 'warning'> = {
  PENDING_REVIEW: 'primary',
  NEEDS_INFO: 'warning',
  ACTIVE: 'success',
  REJECTED: 'danger',
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-fill-soft p-2.5">
      <dt className="text-2xs font-bold text-ink-soft">{label}</dt>
      <dd className="text-sm font-extrabold text-ink">{value}</dd>
    </div>
  );
}

/** Правая колонка раздела «Верификация»: анкета и решение оператора. */
export function ApplicationDetail({
  selectedId,
  detail,
  loading,
  comment,
  onCommentChange,
  deciding,
  decideError,
  onDecide,
  onOpenDocument,
}: {
  selectedId: string | null;
  detail: Application | null;
  loading: boolean;
  comment: string;
  onCommentChange: (value: string) => void;
  deciding: DecisionType | null;
  decideError: string;
  onDecide: (decision: DecisionType) => void;
  onOpenDocument: (doc: { id: string; title: string }) => void;
}) {
  const needComment = !comment.trim();

  return (
    <section
      aria-label="Анкета мастера"
      className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-5"
    >
      {!selectedId && <p className="text-sm text-ink-soft">Выберите анкету в списке</p>}
      {selectedId && loading && (
        <div role="status" aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Загрузка анкеты</span>
          <Skeleton shape="text" className="w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      {selectedId && !loading && detail && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-ink">
              {detail.fullName} · ИИН {detail.iin}
            </h2>
            <Badge tone={STATUS_TONE[detail.status]}>{MASTER_STATUS_LABELS[detail.status]}</Badge>
          </div>

          <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Fact label="Опыт" value={`${detail.experienceYears} лет`} />
            <Fact label="Категории" value={detail.categories.map((c) => c.category.name).join(', ')} />
            <Fact label="Геозона" value={detail.district} />
            <Fact label="Телефон" value={`+7 ··· ${detail.user.phone.replace(/\D/g, '').slice(-4)}`} />
          </dl>

          <h3 className="text-sm font-extrabold text-ink">Документы</h3>
          <div className="flex flex-wrap gap-2.5">
            {detail.documents.map((doc) => {
              const viewable = documentIsViewable(doc);
              return (
                <button
                  key={doc.id}
                  type="button"
                  disabled={!viewable}
                  onClick={() => onOpenDocument({ id: doc.id, title: DOCUMENT_TYPE_LABELS[doc.type] })}
                  className="flex w-44 flex-col gap-1 rounded-md border border-border bg-fill-faint p-2.5 text-left transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-fill-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-xs font-extrabold text-ink">{DOCUMENT_TYPE_LABELS[doc.type]}</span>
                  <span className="inline-flex items-center gap-1 text-2xs text-ink-soft">
                    {viewable ? (
                      <>
                        <PhotoIcon size={14} />
                        открыть
                      </>
                    ) : (
                      `проверка: ${doc.scanStatus.toLowerCase()}`
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {detail.status !== 'PENDING_REVIEW' ? (
            <Alert
              tone={
                detail.status === 'ACTIVE' ? 'success' : detail.status === 'REJECTED' ? 'danger' : 'warning'
              }
              title={
                detail.status === 'ACTIVE'
                  ? 'Мастер одобрен и активирован.'
                  : detail.status === 'NEEDS_INFO'
                    ? 'Запрошены дополнительные данные.'
                    : `Заявка отклонена. ${detail.rejectionReason ?? ''}`
              }
            >
              {detail.decisions[0] && (
                <span className="text-xs font-semibold">
                  {detail.decisions[0].operator.name ?? detail.decisions[0].operator.phone}
                  {detail.decisions[0].comment && `: ${detail.decisions[0].comment}`}
                </span>
              )}
            </Alert>
          ) : (
            <>
              <Textarea
                label="Комментарий решения"
                hint="Обязателен при отказе или запросе данных."
                rows={3}
                value={comment}
                onChange={(e) => onCommentChange(e.target.value)}
              />
              {decideError && <Alert tone="danger">{decideError}</Alert>}
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  variant="success"
                  size="sm"
                  loading={deciding === 'APPROVE'}
                  disabled={deciding !== null}
                  onClick={() => onDecide('APPROVE')}
                >
                  Одобрить
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={deciding === 'REQUEST_INFO'}
                  disabled={deciding !== null || needComment}
                  onClick={() => onDecide('REQUEST_INFO')}
                >
                  Запросить данные
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={deciding === 'REJECT'}
                  disabled={deciding !== null || needComment}
                  onClick={() => onDecide('REJECT')}
                >
                  Отклонить
                </Button>
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
    </section>
  );
}
