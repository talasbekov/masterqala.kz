'use client';

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Отмена',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-ink/40 md:hidden" onClick={onClose}>
      <div
        className="w-full rounded-t-sheet bg-surface px-5 pb-6 pt-3.5 shadow-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-9.5 rounded-full bg-border" />
        <h3 className="text-base font-extrabold text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`w-full rounded-pill p-3.5 text-sm font-extrabold text-white disabled:opacity-40 ${
              danger ? 'bg-danger' : 'bg-primary'
            }`}
          >
            {busy ? 'Подождите…' : confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="w-full rounded-pill border-[1.5px] border-border p-3.5 text-sm font-extrabold text-ink disabled:opacity-40"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
