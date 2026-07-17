import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

interface Detail {
  id: string;
  orderId: string | null;
  plannedOrderId: string | null;
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

  if (!detail) return <p className="p-6">Загрузка…</p>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <Link to="/admin/disputes" className="text-sm text-gray-500">← К списку</Link>
      <h1 className="text-2xl font-bold">Спор по {detail.orderId ? 'срочной' : 'плановой'} заявке</h1>
      <div className="rounded border p-4 space-y-1">
        <p>Открыл: {detail.openedByRole === 'CLIENT' ? 'клиент' : 'мастер'}</p>
        <p>Причина: {detail.reason}</p>
        {detail.counterStatement && <p>Пояснение второй стороны: {detail.counterStatement}</p>}
      </div>
      {detail.evidenceDocIds.length > 0 && (
        <div className="rounded border p-4">
          <h2 className="font-semibold">Доказательства</h2>
          <ul>
            {detail.evidenceDocIds.map((docId) => (
              <li key={docId}>
                <button className="text-teal-700 underline" onClick={() => openEvidence(docId)}>Фото</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {detail.status === 'OPEN' && (
        <div className="rounded border p-4 space-y-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={refundServiceFee} onChange={(e) => setRefundServiceFee(e.target.checked)} />
            Вернуть сервисный сбор клиенту
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={penalizeMaster} onChange={(e) => setPenalizeMaster(e.target.checked)} />
            Оштрафовать мастера
          </label>
          <textarea
            className="w-full rounded border p-2"
            placeholder="Комментарий к решению"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
          />
          <button className="rounded bg-teal-700 px-4 py-2 text-white" onClick={resolve}>Закрыть спор</button>
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
