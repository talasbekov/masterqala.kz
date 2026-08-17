'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { api, apiUpload } from '@/lib/api';

interface Dispute {
  id: string;
  status: string;
  reason: string;
  counterStatement: string | null;
}

const CATEGORY_KEYS = ['categoryQuality', 'categoryPrice', 'categoryBehavior', 'categoryOther'] as const;

export default function DisputeView({ kind }: { kind: 'orders' | 'planned-orders' }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [freePilot, setFreePilot] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORY_KEYS)[number]>('categoryQuality');
  const [text, setText] = useState('');
  const [textError, setTextError] = useState('');
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
    if (!text.trim()) {
      setTextError(t('dispute.textRequired'));
      return;
    }
    setTextError('');
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      <div className="flex items-center gap-2.5">
        <IconButton label={t('common.back')} icon={<ArrowLeftIcon size={20} />} onClick={() => router.back()} />
        <h1 className="flex-1 text-base font-extrabold text-ink">{t('dispute.title', { id: id?.slice(0, 8) })}</h1>
        {dispute && <Badge tone="warning">{t('dispute.opened')}</Badge>}
      </div>

      {!dispute && (
        <>
          <p className="text-sm font-extrabold text-ink">{t('dispute.reasonLabel')}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('dispute.reasonLabel')}>
            {CATEGORY_KEYS.map((key) => (
              <Button
                key={key}
                size="sm"
                variant={category === key ? 'primary' : 'secondary'}
                aria-pressed={category === key}
                onClick={() => setCategory(key)}
              >
                {t(`dispute.${key}`)}
              </Button>
            ))}
          </div>
          <Textarea
            label={t('dispute.detailsLabel')}
            required
            rows={4}
            value={text}
            error={textError}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('dispute.placeholder')}
          />
          <p className="rounded-md bg-surface-sunken p-3 text-xs leading-relaxed font-semibold text-on-fill">
            {freePilot
              ? 'Мастер сможет дать пояснение, после чего оператор рассмотрит спор. Платформа не может вернуть оплату, переданную мастеру напрямую, но может зафиксировать нарушение, ограничить мастера и помочь сторонам урегулировать ситуацию.'
              : t('dispute.note')}
          </p>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="mt-auto" />
          <Button size="lg" fullWidth loading={submitting} onClick={send}>
            {t('dispute.send')}
          </Button>
        </>
      )}

      {dispute && (
        <>
          <Card>
            <p className="text-sm font-extrabold text-ink">{dispute.reason}</p>
            {evidenceCount > 0 && (
              <p className="mt-1 text-xs text-ink-soft">{t('common.photosCount', { n: evidenceCount })}</p>
            )}
          </Card>
          <p className="text-sm font-extrabold text-ink">
            {t('dispute.evidenceLabel')}{' '}
            <span className="text-xs font-semibold text-ink-soft">{t('dispute.evidenceHint')}</span>
          </p>
          <label className="flex size-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-primary text-primary">
            <PlusIcon size={22} />
            <span className="sr-only">{t('dispute.addEvidence')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && uploadEvidence(e.target.files[0])}
            />
          </label>
          {error && <Alert tone="danger">{error}</Alert>}
          <ol className="flex flex-col gap-2 text-xs">
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              <span className="font-bold text-ink">{t('dispute.sentAt')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
              <span className="font-bold text-ink">{t('dispute.waitingMaster')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-border" aria-hidden="true" />
              <span className="font-semibold text-ink-soft">{t('dispute.waitingOperator')}</span>
            </li>
          </ol>
          <p className="rounded-md bg-surface-sunken p-3 text-xs leading-relaxed font-semibold text-on-fill">
            {t('dispute.pausedNote')}
          </p>
        </>
      )}
    </div>
  );
}
