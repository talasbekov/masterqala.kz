'use client';
import { useEffect, useId, useState } from 'react';
import { Alert, IconButton, Skeleton, CloseIcon } from '@masterqala/ui';
import { apiBlob } from '@/lib/api';

export function Lightbox({ path, title, onClose }: { path: string; title: string; onClose: () => void }) {
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const titleId = useId();

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setState('loading');

    apiBlob(path)
      .then(({ blob, contentType }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        if ((contentType ?? '').startsWith('image/')) {
          setObjectUrl(url);
          setState('ready');
        } else {
          window.open(url, '_blank');
          onClose();
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setErrorMessage((e as Error).message);
        setState('error');
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Просмотрщик — модальное окно: без выхода по Escape пользователь клавиатуры
  // остаётся в нём запертым.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 sm:p-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-full w-full max-w-3xl overflow-auto rounded-lg bg-surface p-4 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-6">
          <h2 id={titleId} className="text-sm font-extrabold text-ink">
            {title}
          </h2>
          <IconButton label="Закрыть" icon={<CloseIcon />} onClick={onClose} />
        </div>
        {state === 'loading' && (
          <div role="status" aria-busy="true">
            <span className="sr-only">Загрузка документа</span>
            <Skeleton className="h-64 w-full" />
          </div>
        )}
        {state === 'error' && <Alert tone="danger" title="Не удалось открыть документ">{errorMessage}</Alert>}
        {state === 'ready' && objectUrl && (
          <img src={objectUrl} alt={title} className="max-h-[70vh] max-w-full" />
        )}
      </div>
    </div>
  );
}
