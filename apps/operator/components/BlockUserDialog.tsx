'use client';
import { Button, Textarea } from '@masterqala/ui';
import { Dialog } from './Dialog';
import type { OperatorUserRow } from '@/lib/users';

export function BlockUserDialog({
  target,
  reason,
  onReasonChange,
  submitting,
  onConfirm,
  onCancel,
}: {
  target: OperatorUserRow;
  reason: string;
  onReasonChange: (value: string) => void;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      title={`Заблокировать ${target.name ?? target.phone}`}
      onClose={onCancel}
      footer={
        <>
          <Button
            variant="danger"
            loading={submitting}
            loadingLabel="Блокируем…"
            disabled={!reason.trim()}
            onClick={onConfirm}
          >
            Подтвердить
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
        </>
      }
    >
      <Textarea
        label="Причина блокировки"
        required
        hint="Причину увидит оператор в журнале действий."
        rows={3}
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
      />
    </Dialog>
  );
}
