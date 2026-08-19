'use client';
import { useEffect, useState } from 'react';
import {
  fetchMyDisputes,
  fetchDisputeContext,
  fetchDisputeEvidence,
  submitCounterStatement,
  uploadDisputeEvidence,
  type DisputeDetail,
  type DisputeEvidence,
} from '@/lib/disputes';

export function DisputeDetailView({ disputeId }: { disputeId: string }) {
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const summaries = await fetchMyDisputes();
    const summary = summaries.find((d) => d.id === disputeId);
    if (!summary) {
      setError('Спор не найден');
      return;
    }
    const kind = summary.orderId ? 'orders' : 'planned-orders';
    const targetId = summary.orderId ?? summary.plannedOrderId!;
    const [context, evidenceList] = await Promise.all([
      fetchDisputeContext(kind, targetId),
      fetchDisputeEvidence(disputeId),
    ]);
    setDispute(context.dispute);
    setEvidence(evidenceList);
  }

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, [disputeId]);

  async function send() {
    if (!window.confirm('Пояснение нельзя будет изменить после отправки. Отправить?')) return;
    setError('');
    setSubmitting(true);
    try {
      const updated = await submitCounterStatement(disputeId, draft);
      setDispute(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadPhoto(file: File) {
    setError('');
    setUploading(true);
    try {
      await uploadDisputeEvidence(disputeId, file);
      const evidenceList = await fetchDisputeEvidence(disputeId);
      setEvidence(evidenceList);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!dispute) {
    return <div className="p-8 text-ink-soft">{error || 'Загрузка…'}</div>;
  }

  const clientPhotos = evidence.filter((e) => !e.isMine);
  const myPhotos = evidence.filter((e) => e.isMine);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 text-lg font-extrabold text-ink">Спор по заявке №{dispute.id.slice(0, 8)}</h1>
        <span
          className={`rounded-pill px-2.5 py-1 text-[11px] font-extrabold ${
            dispute.status === 'OPEN' ? 'bg-warning-bg text-warning-ink' : 'bg-success-bg text-success-ink'
          }`}
        >
          {dispute.status === 'OPEN' ? 'Открыт' : 'Решён'}
        </span>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <div className="mb-1 text-xs font-bold uppercase text-ink-soft">Заявление клиента</div>
        <div className="text-sm text-ink">{dispute.reason}</div>
        {clientPhotos.length > 0 && (
          <div className="mt-2 text-xs text-ink-soft">Фото клиента: {clientPhotos.length}</div>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-extrabold text-ink">Моё пояснение</div>
        {dispute.counterStatement ? (
          <div className="rounded-md border border-border bg-surface p-4 text-sm text-ink">
            {dispute.counterStatement}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Опишите свою позицию по спору"
              className="min-h-24 rounded-md border-[1.5px] border-border bg-surface p-3.5 text-sm text-ink outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={send}
              disabled={submitting || !draft.trim()}
              className="rounded-pill bg-primary p-3 text-sm font-extrabold text-white disabled:opacity-40"
            >
              Отправить
            </button>
          </div>
        )}
      </div>

      {dispute.status === 'OPEN' && (
        <div>
          <div className="mb-2 text-sm font-extrabold text-ink">
            Мои фото {myPhotos.length > 0 && <span className="text-xs font-semibold text-ink-soft">({myPhotos.length})</span>}
          </div>
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-dashed border-primary text-xl text-primary">
            {uploading ? '…' : '＋'}
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
            />
          </label>
        </div>
      )}

      {error && <p className="text-sm font-semibold text-danger">{error}</p>}

      {dispute.status === 'RESOLVED' && (
        <div className="rounded-md bg-fill p-4 text-sm text-ink">
          <div className="mb-1 text-xs font-bold uppercase text-ink-soft">Исход</div>
          {dispute.resolutionNote && <p>{dispute.resolutionNote}</p>}
          {dispute.refundServiceFee !== null && (
            <p className="mt-1 text-xs text-ink-soft">
              {dispute.refundServiceFee ? 'Клиенту возвращён сервисный сбор' : 'Возврат сервисного сбора не производился'}
            </p>
          )}
          {dispute.penalizeMaster !== null && (
            <p className="mt-1 text-xs text-ink-soft">
              {dispute.penalizeMaster ? 'К вам применён штраф' : 'Штраф не применён'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
