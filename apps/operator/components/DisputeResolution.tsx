'use client';
import { Alert, Button, Textarea } from '@masterqala/ui';

/** Блок решения оператора по спору: флажки, комментарий и подтверждение. */
export function DisputeResolution({
  canRefundServiceFee,
  hasOrder,
  refundServiceFee,
  onRefundChange,
  penalizeMaster,
  onPenalizeChange,
  resolutionNote,
  onNoteChange,
  confirming,
  onStartConfirm,
  onCancelConfirm,
  resolving,
  resolveError,
  onConfirm,
}: {
  canRefundServiceFee: boolean;
  hasOrder: boolean;
  refundServiceFee: boolean;
  onRefundChange: (value: boolean) => void;
  penalizeMaster: boolean;
  onPenalizeChange: (value: boolean) => void;
  resolutionNote: string;
  onNoteChange: (value: string) => void;
  confirming: boolean;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  resolving: boolean;
  resolveError: string;
  onConfirm: () => void;
}) {
  const needComment = !resolutionNote.trim();

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <h3 className="text-sm font-extrabold text-ink">Решение оператора</h3>

      {canRefundServiceFee ? (
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={refundServiceFee}
            onChange={(e) => onRefundChange(e.target.checked)}
          />
          Вернуть сервисный сбор клиенту
        </label>
      ) : hasOrder ? (
        <p className="rounded-md bg-fill-faint p-2 text-xs text-ink-soft">
          В бесплатном пилоте сервисный сбор не взимался, возврат недоступен.
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={penalizeMaster}
          onChange={(e) => onPenalizeChange(e.target.checked)}
        />
        Санкция мастеру
      </label>

      <Textarea
        label="Комментарий решения"
        required
        hint="Увидят обе стороны спора."
        rows={3}
        value={resolutionNote}
        onChange={(e) => onNoteChange(e.target.value)}
      />

      {!confirming ? (
        <div className="flex flex-col gap-1">
          <Button size="sm" disabled={needComment} onClick={onStartConfirm} className="self-start">
            Решить спор
          </Button>
          {needComment && (
            <span className="text-xs font-bold text-warning-ink">введите комментарий решения</span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-md bg-warning-soft p-3">
          <p className="text-xs font-bold text-warning-ink">
            Подтвердите: {refundServiceFee && 'сбор будет возвращён'}
            {refundServiceFee && penalizeMaster && ', '}
            {penalizeMaster && 'мастер получит санкцию'}
            {!refundServiceFee && !penalizeMaster && 'решение без возврата и без санкции'}. Действие
            необратимо и попадёт в журнал.
          </p>
          {resolveError && <Alert tone="danger">{resolveError}</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              loading={resolving}
              loadingLabel="Сохраняем…"
              onClick={onConfirm}
            >
              Подтверждаю решение
            </Button>
            <Button variant="secondary" size="sm" disabled={resolving} onClick={onCancelConfirm}>
              Назад
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
