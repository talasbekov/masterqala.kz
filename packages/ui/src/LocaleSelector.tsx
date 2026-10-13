'use client';
import { useEffect, useId, useRef } from 'react';
import type { MouseEvent } from 'react';
import { LOCALE_COPY, LOCALES } from './locale-dialog-data';
import type { Locale } from './locale-dialog-data';
import { Button } from './Button';

const LABELS: Record<Locale, string> = { ru: 'Русский', kk: 'Қазақша', en: 'English' };

export interface LocaleSelectorProps {
  open: boolean;
  locale: Locale;
  onSelect: (locale: Locale) => void;
  onDismiss: () => void;
}

/** Figma 412:1520. Changing display language never changes business state. */
export function LocaleSelector({ open, locale, onSelect, onDismiss }: LocaleSelectorProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const noteId = useId();
  const copy = LOCALE_COPY[locale];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function dismissBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onDismiss();
  }

  return (
    <dialog ref={ref} className="mq-locale-selector" aria-labelledby={titleId} aria-describedby={noteId}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }} onClick={dismissBackdrop}>
      <h2 id={titleId} className="mq-locale-title">{copy.title}</h2>
      {LOCALES.map((code) => (
        <Button key={code} variant="secondary" fullWidth lang={code}
          aria-pressed={locale === code} onClick={() => { onSelect(code); onDismiss(); }}>
          {LABELS[code]}
        </Button>
      ))}
      <p id={noteId} className="mq-locale-note">{copy.note}</p>
    </dialog>
  );
}
