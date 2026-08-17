'use client';
import { useEffect, useId, type ReactNode } from 'react';
import { IconButton, CloseIcon } from '@masterqala/ui';

/*
 * Общая оболочка модального окна панели оператора.
 *
 * До миграции модалки собирались прямо в теле страниц: обычный <div> поверх
 * затемнения, без role="dialog", без aria-modal и без выхода по Escape —
 * пользователь клавиатуры не мог её закрыть, а скринридер не сообщал, что
 * открылось окно. Здесь это сделано один раз для всех.
 */

export function Dialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto rounded-lg bg-surface p-5 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-extrabold text-ink">
            {title}
          </h2>
          <IconButton label="Закрыть" icon={<CloseIcon />} onClick={onClose} />
        </div>
        {children}
        {footer ? <div className="flex flex-wrap gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
