import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ArrowLeftIcon,
  Badge,
  Button,
  Card,
  IconButton,
  PlusIcon,
  Textarea,
} from '@masterqala/ui';
import { api, apiUpload } from '../../../api';

interface Dispute {
  id: string;
  status: string;
  reason: string;
  counterStatement: string | null;
}

const CATEGORY_KEYS = ['categoryQuality', 'categoryPrice', 'categoryBehavior', 'categoryOther'] as const;

export default function DisputePage({ kind }: { kind: 'orders' | 'planned-orders' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [freePilot, setFreePilot] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORY_KEYS)[number]>('categoryQuality');
  const [text, setText] = useState('');
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/${kind}/${id}`)
      .then((order) => {
        setDispute(order.dispute ?? null);
        setFreePilot(order.commercialMode === 'FREE_PILOT' || order.freePilot === true);
      })
      .catch((e) => setError((e as Error).message));
  }, [id, kind]);

  async function send() {
    setError('');
    setSubmitting(true);
    try {
      const reason = `${t(`dispute.${category}`)}. ${text}`.trim();
      const created = await api(`/${kind}/${id}/disputes`, { method: 'POST', body: JSON.stringify({ reason }) });
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
        <IconButton label={t('common.back')} icon={<ArrowLeftIcon />} onClick={() => navigate(-1)} />
        <h1 className="flex-1 text-base font-extrabold text-ink">{t('dispute.title', { id: id?.slice(0, 8) })}</h1>
        {dispute && <Badge tone="warning">{t('dispute.opened')}</Badge>}
      </div>

      {!dispute && (
        <>
          <div className="text-sm font-extrabold text-ink">{t('dispute.reasonLabel')}</div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                aria-pressed={category === key}
                className={`min-h-11 rounded-pill px-3.5 py-1.5 text-xs font-bold ${
                  category === key
                    ? 'bg-primary text-on-primary'
                    : 'border border-border-strong text-ink-soft'
                }`}
              >
                {t(`dispute.${key}`)}
              </button>
            ))}
          </div>
          <Textarea
            label={t('dispute.reasonLabel')}
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('dispute.placeholder')}
            className="min-h-24"
          />
          <div className="rounded-md bg-fill p-3 text-xs font-semibold leading-relaxed text-ink">
            {freePilot
              ? 'Мастер сможет дать пояснение, после чего оператор рассмотрит спор. Платформа не может вернуть оплату, переданную мастеру напрямую, но может зафиксировать нарушение, ограничить мастера и помочь сторонам урегулировать ситуацию.'
              : t('dispute.note')}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="mt-auto" />
          <Button fullWidth size="lg" loading={submitting} disabled={!text} onClick={send}>
            {t('dispute.send')}
          </Button>
        </>
      )}

      {dispute && (
        <>
          <Card padding="sm">
            <div className="text-sm font-extrabold text-ink">{dispute.reason}</div>
            {evidenceCount > 0 && (
              <div className="mt-1 text-xs text-ink-soft">{t('common.photosCount', { n: evidenceCount })}</div>
            )}
          </Card>
          <div className="text-sm font-extrabold text-ink">
            {t('dispute.evidenceLabel')} <span className="text-xs font-semibold text-ink-soft">{t('dispute.evidenceHint')}</span>
          </div>
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-primary text-primary">
            <PlusIcon size={22} />
            <span className="sr-only">{t('common.addPhoto')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && uploadEvidence(e.target.files[0])}
            />
          </label>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="font-bold text-ink">{t('dispute.sentAt')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-bold text-ink">{t('dispute.waitingMaster')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-border" />
              <span className="font-semibold text-ink-soft">{t('dispute.waitingOperator')}</span>
            </div>
          </div>
          <div className="rounded-md bg-fill p-3 text-xs font-semibold leading-relaxed text-ink">{t('dispute.pausedNote')}</div>
        </>
      )}
    </div>
  );
}
