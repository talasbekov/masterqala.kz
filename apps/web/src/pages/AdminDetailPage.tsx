import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const STATUS_RU: Record<string, string> = {
  PENDING_REVIEW: 'На проверке',
  NEEDS_INFO: 'Нужны данные',
  ACTIVE: 'Активен',
  REJECTED: 'Отклонена',
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

  if (!detail) return <p className="p-6">Загрузка…</p>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Link to="/admin" className="text-sm text-gray-500">← К списку</Link>
      <h1 className="text-2xl font-bold">{detail.fullName}</h1>
      <div className="rounded border p-4 space-y-1">
        <p>Телефон: {detail.user.phone}</p>
        <p>ИИН: {detail.iin}</p>
        <p>Район: {detail.district}</p>
        <p>Опыт: {detail.experienceYears} лет</p>
        <p>Категории: {detail.categories.map((c) => c.category.name).join(', ')}</p>
        <p>Статус: {STATUS_RU[detail.status] ?? detail.status}</p>
      </div>

      <div className="rounded border p-4">
        <h2 className="font-semibold">Документы</h2>
        {detail.documents.length === 0 && <p className="text-gray-500">Нет документов</p>}
        <ul>
          {detail.documents.map((d) => (
            <li key={d.id}>
              <button className="text-teal-700 underline" onClick={() => openDoc(d.id)}>
                {d.type === 'ID_CARD' ? 'Удостоверение' : 'Квалификация'}: {d.originalName}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {detail.status === 'PENDING_REVIEW' && (
        <div className="rounded border p-4 space-y-3">
          <textarea
            className="w-full rounded border p-2"
            placeholder="Комментарий (обязателен для отклонения и запроса данных)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="rounded bg-green-700 px-4 py-2 text-white" onClick={() => decide('APPROVE')}>Одобрить</button>
            <button className="rounded bg-yellow-600 px-4 py-2 text-white" onClick={() => decide('REQUEST_INFO')}>Запросить данные</button>
            <button className="rounded bg-red-700 px-4 py-2 text-white" onClick={() => decide('REJECT')}>Отклонить</button>
          </div>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}

      <div className="rounded border p-4">
        <h2 className="font-semibold">Журнал решений</h2>
        {detail.decisions.length === 0 && <p className="text-gray-500">Решений не было</p>}
        <ul className="text-sm">
          {detail.decisions.map((d) => (
            <li key={d.id}>
              {new Date(d.createdAt).toLocaleString('ru-RU')} — {DECISION_RU[d.decision] ?? d.decision} ({d.operator.phone})
              {d.comment && `: ${d.comment}`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
