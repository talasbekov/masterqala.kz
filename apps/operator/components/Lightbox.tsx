'use client';
import { useEffect, useState } from 'react';
import { apiBlob } from '@/lib/api';

export function Lightbox({ path, title, onClose }: { path: string; title: string; onClose: () => void }) {
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8" onClick={onClose}>
      <div
        className="max-h-full max-w-3xl overflow-auto rounded-lg bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-6">
          <span className="text-sm font-extrabold text-ink">{title}</span>
          <button type="button" onClick={onClose} className="text-sm font-bold text-ink-soft">
            Закрыть ✕
          </button>
        </div>
        {state === 'loading' && <div className="p-8 text-center text-ink-soft">Загрузка…</div>}
        {state === 'error' && <div className="p-8 text-center text-danger">Ошибка: {errorMessage}</div>}
        {state === 'ready' && objectUrl && (
          <img src={objectUrl} alt={title} className="max-h-[70vh] max-w-full" />
        )}
      </div>
    </div>
  );
}
