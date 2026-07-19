import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '../../../api';

interface Dispute {
  id: string;
  status: string;
  reason: string;
  counterStatement: string | null;
}

const CATEGORY_KEYS = ['categoryQuality', 'categoryPrice', 'categoryBehavior', 'categoryOther'] as const;

export default function DisputePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORY_KEYS)[number]>('categoryQuality');
  const [text, setText] = useState('');
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/orders/${id}`)
      .then((o) => setDispute(o.dispute ?? null))
      .catch((e) => setError((e as Error).message));
  }, [id]);

  async function send() {
    setError('');
    setSubmitting(true);
    try {
      const reason = `${t(`dispute.${category}`)}. ${text}`.trim();
      const created = await api(`/orders/${id}/disputes`, { method: 'POST', body: JSON.stringify({ reason }) });
      setDispute(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadEvidence(file: File) {
    if (!dispute) return;
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      await apiUpload(`/disputes/${dispute.id}/evidence`, fd);
      setEvidenceCount((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate(-1)} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="flex-1 text-[17px] font-extrabold text-c2-ink">{t('dispute.title', { id: id?.slice(0, 8) })}</span>
        {dispute && (
          <span className="rounded-c2-pill bg-c2-warning-bg px-2.5 py-1 text-[11px] font-extrabold text-c2-warning-ink">
            {t('dispute.opened')}
          </span>
        )}
      </div>

      {!dispute && (
        <>
          <div className="text-sm font-extrabold text-c2-ink">{t('dispute.reasonLabel')}</div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`rounded-c2-pill px-3.5 py-1.5 text-xs font-bold ${
                  category === key ? 'bg-c2-primary text-white' : 'border-[1.5px] border-c2-border text-c2-ink-soft'
                }`}
              >
                {t(`dispute.${key}`)}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('dispute.placeholder')}
            className="min-h-24 rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3.5 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
          <div className="rounded-c2-md bg-c2-fill p-3 text-xs font-semibold leading-relaxed text-c2-ink">{t('dispute.note')}</div>
          {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={send}
            disabled={submitting || !text}
            className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
          >
            {t('dispute.send')}
          </button>
        </>
      )}

      {dispute && (
        <>
          <div className="rounded-c2-md border border-c2-border bg-c2-surface p-3.5">
            <div className="text-sm font-extrabold text-c2-ink">{dispute.reason}</div>
            {evidenceCount > 0 && (
              <div className="mt-1 text-xs text-c2-ink-soft">{t('common.photosCount', { n: evidenceCount })}</div>
            )}
          </div>
          <div className="text-sm font-extrabold text-c2-ink">
            {t('dispute.evidenceLabel')} <span className="text-xs font-semibold text-c2-ink-soft">{t('dispute.evidenceHint')}</span>
          </div>
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-c2-md border-[1.5px] border-dashed border-c2-primary text-xl text-c2-primary">
            ＋
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadEvidence(e.target.files[0])}
            />
          </label>
          {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-c2-success" />
              <span className="font-bold text-c2-ink">{t('dispute.sentAt')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-c2-primary" />
              <span className="font-bold text-c2-ink">{t('dispute.waitingMaster')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-c2-border" />
              <span className="font-semibold text-c2-ink-soft">{t('dispute.waitingOperator')}</span>
            </div>
          </div>
          <div className="rounded-c2-md bg-c2-fill p-3 text-xs font-semibold leading-relaxed text-c2-ink">{t('dispute.pausedNote')}</div>
        </>
      )}
    </div>
  );
}
