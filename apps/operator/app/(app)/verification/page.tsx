'use client';
import { useEffect, useState } from 'react';
import { Alert, Select } from '@masterqala/ui';
import {
  fetchApplications,
  fetchApplication,
  decideApplication,
  type ApplicationListItem,
  type ApplicationDetail as Application,
  type MasterStatus,
  type DecisionType,
} from '@/lib/verification';
import { ApplicationList } from '@/components/ApplicationList';
import { ApplicationDetail } from '@/components/ApplicationDetail';
import { Lightbox } from '@/components/Lightbox';
import { useOperatorMetrics } from '@/lib/operatorMetrics';

const STATUS_FILTERS: { value: MasterStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'все статусы' },
  { value: 'PENDING_REVIEW', label: 'на проверке' },
  { value: 'NEEDS_INFO', label: 'нужны данные' },
  { value: 'ACTIVE', label: 'активен' },
  { value: 'REJECTED', label: 'отклонён' },
];

export default function VerificationPage() {
  const { refetch: refetchMetrics } = useOperatorMetrics();
  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<MasterStatus | 'ALL'>('ALL');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState<DecisionType | null>(null);
  const [decideError, setDecideError] = useState('');
  const [openDoc, setOpenDoc] = useState<{ id: string; title: string } | null>(null);

  async function loadList() {
    try {
      const rows = await fetchApplications();
      setApplications(rows);
      setListError('');
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetchApplication(selectedId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setComment('');
        setDecideError('');
      })
      .catch((e) => {
        if (!cancelled) setListError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filtered = applications.filter((a) => statusFilter === 'ALL' || a.status === statusFilter);

  async function submitDecision(decision: DecisionType) {
    if (!selectedId) return;
    if (decision !== 'APPROVE' && !comment.trim()) return;
    setDeciding(decision);
    setDecideError('');
    try {
      await decideApplication(selectedId, decision, comment.trim() || undefined);
      const [updated] = await Promise.all([fetchApplication(selectedId), loadList()]);
      setDetail(updated);
      setComment('');
      refetchMetrics();
    } catch (e) {
      setDecideError((e as Error).message);
    } finally {
      setDeciding(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-8">
      <h1 className="text-2xl font-extrabold text-ink">Верификация</h1>
      <Select
        label="Статус анкеты"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as MasterStatus | 'ALL')}
        fieldClassName="w-full sm:w-64"
      >
        {STATUS_FILTERS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
      {listError && <Alert tone="danger">{listError}</Alert>}

      {/* Ниже lg колонки складываются: две фиксированные колонки не помещались
          в 1024px вместе с меню. */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full shrink-0 lg:w-72">
          <ApplicationList
            items={filtered}
            loading={listLoading}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <ApplicationDetail
          selectedId={selectedId}
          detail={detail}
          loading={detailLoading}
          comment={comment}
          onCommentChange={setComment}
          deciding={deciding}
          decideError={decideError}
          onDecide={submitDecision}
          onOpenDocument={setOpenDoc}
        />
      </div>

      {openDoc && selectedId && (
        <Lightbox
          path={`/admin/applications/${selectedId}/documents/${openDoc.id}`}
          title={openDoc.title}
          onClose={() => setOpenDoc(null)}
        />
      )}
    </div>
  );
}
