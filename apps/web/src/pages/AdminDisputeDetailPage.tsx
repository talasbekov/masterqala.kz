import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  ArrowLeftIcon,
  Button,
  Card,
  PhotoIcon,
  SkeletonList,
  Textarea,
} from '@masterqala/ui';
import { api } from '../api';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

interface Detail {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
  commercialMode: 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE' | null;
  openedByRole: string;
  reason: string;
  counterStatement: string | null;
  evidenceDocIds: string[];
  status: string;
}

export default function AdminDisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [refundServiceFee, setRefundServiceFee] = useState(false);
  const [penalizeMaster, setPenalizeMaster] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/admin/disputes/${id}`).then(setDetail);
  }, [id]);

  async function resolve() {
    setError('');
    try {
      await api(`/admin/disputes/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ refundServiceFee, penalizeMaster, resolutionNote }),
      });
      navigate('/admin/disputes');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openEvidence(relPath: string) {
    const res = await fetch(`${API}/disputes/${id}/evidence/${encodeURIComponent(relPath)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) return setError(`Не удалось открыть документ (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <SkeletonList rows={3} label="Загрузка спора" />
      </div>
    );
  }

  const canRefundServiceFee = Boolean(detail.orderId && detail.commercialMode !== 'FREE_PILOT');

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link to="/admin/disputes" className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
        <ArrowLeftIcon size={16} />К списку
      </Link>
      <h1 className="text-2xl font-bold text-ink">
        Спор по {detail.orderId ? 'срочной' : 'плановой'} заявке
      </h1>
      {error && <Alert tone="danger">{error}</Alert>}
      <Card className="space-y-1 text-base text-ink">
        <p>Открыл: {detail.openedByRole === 'CLIENT' ? 'клиент' : 'мастер'}</p>
        <p>Причина: {detail.reason}</p>
        <p>Режим заявки: {detail.commercialMode ?? 'не определён'}</p>
        {detail.counterStatement && <p>Пояснение второй стороны: {detail.counterStatement}</p>}
      </Card>
      {detail.evidenceDocIds.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-bold text-ink">Доказательства</h2>
          <ul className="space-y-1">
            {detail.evidenceDocIds.map((docId) => (
              <li key={docId}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<PhotoIcon size={16} />}
                  onClick={() => openEvidence(docId)}
                >
                  Фото
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {detail.status === 'OPEN' && (
        <Card className="space-y-3">
          {canRefundServiceFee ? (
            <label className="flex min-h-11 items-center gap-2 text-base text-ink">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={refundServiceFee}
                onChange={(e) => setRefundServiceFee(e.target.checked)}
              />
              Вернуть сервисный сбор клиенту
            </label>
          ) : detail.orderId ? (
            <Alert tone="info">
              В бесплатном пилоте сервисный сбор не взимался, поэтому возврат через платформу
              недоступен.
            </Alert>
          ) : null}
          <label className="flex min-h-11 items-center gap-2 text-base text-ink">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={penalizeMaster}
              onChange={(e) => setPenalizeMaster(e.target.checked)}
            />
            Оштрафовать мастера
          </label>
          <Textarea
            label="Комментарий к решению"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
          />
          <Button onClick={resolve}>Закрыть спор</Button>
        </Card>
      )}
    </div>
  );
}
