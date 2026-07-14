import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiUpload } from '../api';

interface Category { id: string; slug: string; name: string }
interface Doc { id: string; type: string; originalName: string }
interface Application {
  id: string;
  fullName: string;
  iin: string;
  district: string;
  experienceYears: number;
  status: 'PENDING_REVIEW' | 'NEEDS_INFO' | 'ACTIVE' | 'REJECTED';
  rejectionReason: string | null;
  categories: { category: Category }[];
  documents: Doc[];
}

const STATUS_RU: Record<Application['status'], string> = {
  PENDING_REVIEW: 'На проверке',
  NEEDS_INFO: 'Нужны дополнительные данные',
  ACTIVE: 'Активен — вы мастер!',
  REJECTED: 'Отклонена',
};

const DOC_TYPES = [
  { value: 'ID_CARD', label: 'Удостоверение личности' },
  { value: 'QUALIFICATION', label: 'Подтверждение квалификации' },
];

export default function BecomeMasterPage() {
  const [app, setApp] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ fullName: '', iin: '', district: '', experienceYears: 0 });
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const cats = await api('/categories');
    setCategories(cats);
    try {
      const a = await api('/masters/application');
      setApp(a);
      setForm({ fullName: a.fullName, iin: a.iin, district: a.district, experienceYears: a.experienceYears });
      setSelectedCats(a.categories.map((c: { category: Category }) => c.category.id));
    } catch {
      setApp(null);
    }
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    setError('');
    try {
      await api('/masters/application', {
        method: 'POST',
        body: JSON.stringify({ ...form, experienceYears: Number(form.experienceYears), categoryIds: selectedCats }),
      });
      setEditing(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function upload(type: string, file: File) {
    setError('');
    const fd = new FormData();
    fd.append('type', type);
    fd.append('file', file);
    try {
      await apiUpload('/masters/application/documents', fd);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!loaded) return <p className="p-6">Загрузка…</p>;

  const showForm = editing || !app;
  const canUpload = app && (app.status === 'PENDING_REVIEW' || app.status === 'NEEDS_INFO');
  const canResubmit = app && (app.status === 'NEEDS_INFO' || app.status === 'REJECTED');

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <Link to="/" className="text-sm text-gray-500">← Назад</Link>
      <h1 className="text-2xl font-bold">Стать мастером</h1>

      {app && !editing && (
        <div className="rounded border p-4 space-y-2">
          <p className="font-semibold">Статус: {STATUS_RU[app.status]}</p>
          {app.status === 'REJECTED' && app.rejectionReason && (
            <p className="text-red-600">Причина: {app.rejectionReason}</p>
          )}
          {canResubmit && (
            <button className="rounded bg-teal-700 px-4 py-2 text-white" onClick={() => setEditing(true)}>
              Подать заново
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="space-y-3">
          <input className="w-full rounded border p-3" placeholder="ФИО полностью" value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="w-full rounded border p-3" placeholder="ИИН (12 цифр)" value={form.iin}
            onChange={(e) => setForm({ ...form, iin: e.target.value })} />
          <input className="w-full rounded border p-3" placeholder="Район" value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })} />
          <input className="w-full rounded border p-3" type="number" placeholder="Опыт, лет" value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })} />
          <fieldset className="space-y-1">
            <legend className="font-semibold">Категории</legend>
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCats.includes(c.id)}
                  onChange={(e) =>
                    setSelectedCats(e.target.checked
                      ? [...selectedCats, c.id]
                      : selectedCats.filter((id) => id !== c.id))
                  }
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={submit}>
            Отправить на проверку
          </button>
        </div>
      )}

      {canUpload && (
        <div className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Документы</h2>
          {DOC_TYPES.map((dt) => (
            <div key={dt.value}>
              <label className="block text-sm">{dt.label}</label>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => e.target.files?.[0] && upload(dt.value, e.target.files[0])}
              />
              <ul className="text-sm text-gray-600">
                {app!.documents.filter((d) => d.type === dt.value).map((d) => (
                  <li key={d.id}>✓ {d.originalName}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
