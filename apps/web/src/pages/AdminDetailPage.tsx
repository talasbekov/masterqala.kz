import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  ArrowLeftIcon,
  Badge,
  Button,
  Card,
  DocumentIcon,
  SkeletonList,
  Textarea,
} from '@masterqala/ui';
import type { BadgeTone } from '@masterqala/ui';
import { api } from '../api';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const STATUS_RU: Record<string, string> = {
  PENDING_REVIEW: 'На проверке',
  NEEDS_INFO: 'Нужны данные',
  ACTIVE: 'Активен',
  REJECTED: 'Отклонена',
};
const STATUS_TONES: Record<string, BadgeTone> = {
  PENDING_REVIEW: 'warning',
  NEEDS_INFO: 'warning',
  ACTIVE: 'success',
  REJECTED: 'danger',
};
const DECISION_RU: Record<string, string> = {
  APPROVE: 'Одобрено',
  REJECT: 'Отклонено',
  REQUEST_INFO: 'Запрошены данные',
};

interface Detail {
  id: string;
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  status: string;
  rejectionReason: string | null;
  user: { phone: string };
  categories: { category: { name: string } }[];
  documents: { id: string; type: string; originalName: string }[];
  decisions: { id: string; decision: string; comment: string | null; createdAt: string; operator: { phone: string } }[];
}

export default function AdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/admin/applications/${id}`).then(setDetail);
  }, [id]);

  async function decide(decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO') {
    setError('');
    try {
      await api(`/admin/applications/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment: comment || undefined }),
      });
      navigate('/admin');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openDoc(docId: string) {
    setError('');
    const res = await fetch(`${API}/admin/applications/${id}/documents/${docId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) {
      setError(`Не удалось открыть документ (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <SkeletonList rows={3} label="Загрузка заявки мастера" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
        <ArrowLeftIcon size={16} />К списку
      </Link>
      <h1 className="text-2xl font-bold text-ink">{detail.fullName}</h1>
      {error && <Alert tone="danger">{error}</Alert>}
      <Card className="space-y-1 text-base text-ink">
        <p>Телефон: {detail.user.phone}</p>
        <p>ИИН: {detail.iin}</p>
        <p>Район: {detail.district}</p>
        <p>Опыт: {detail.experienceYears} лет</p>
        <p>Категории: {detail.categories.map((c) => c.category.name).join(', ')}</p>
        <p className="flex items-center gap-2 pt-1">
          Статус:{' '}
          <Badge tone={STATUS_TONES[detail.status] ?? 'neutral'}>
            {STATUS_RU[detail.status] ?? detail.status}
          </Badge>
        </p>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold text-ink">Документы</h2>
        {detail.documents.length === 0 && <p className="text-sm text-ink-soft">Нет документов</p>}
        <ul className="space-y-1">
          {detail.documents.map((d) => (
            <li key={d.id}>
              <Button
                variant="ghost"
                size="sm"
                icon={<DocumentIcon size={16} />}
                onClick={() => openDoc(d.id)}
              >
                {d.type === 'ID_CARD' ? 'Удостоверение' : 'Квалификация'}: {d.originalName}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {detail.status === 'PENDING_REVIEW' && (
        <Card className="space-y-3">
          <Textarea
            label="Комментарий к решению"
            hint="Обязателен для отклонения и запроса данных"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="success" onClick={() => decide('APPROVE')}>
              Одобрить
            </Button>
            <Button variant="secondary" onClick={() => decide('REQUEST_INFO')}>
              Запросить данные
            </Button>
            <Button variant="danger" onClick={() => decide('REJECT')}>
              Отклонить
            </Button>
          </div>
        </Card>
      )}

      <Card className="space-y-2">
        <h2 className="font-bold text-ink">Журнал решений</h2>
        {detail.decisions.length === 0 && <p className="text-sm text-ink-soft">Решений не было</p>}
        <ul className="space-y-1 text-sm text-ink-soft">
          {detail.decisions.map((d) => (
            <li key={d.id}>
              {new Date(d.createdAt).toLocaleString('ru-RU')} — {DECISION_RU[d.decision] ?? d.decision} ({d.operator.phone})
              {d.comment && `: ${d.comment}`}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
