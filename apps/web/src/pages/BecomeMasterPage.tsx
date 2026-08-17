import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  ArrowLeftIcon,
  Badge,
  Button,
  Card,
  CheckIcon,
  Input,
  SkeletonList,
} from '@masterqala/ui';
import type { BadgeTone } from '@masterqala/ui';
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
  latestDecisionComment: string | null;
  categories: { category: Category }[];
  documents: Doc[];
}

const STATUS_RU: Record<Application['status'], string> = {
  PENDING_REVIEW: 'На проверке',
  NEEDS_INFO: 'Нужны дополнительные данные',
  ACTIVE: 'Активен — вы мастер!',
  REJECTED: 'Отклонена',
};

const STATUS_TONES: Record<Application['status'], BadgeTone> = {
  PENDING_REVIEW: 'warning',
  NEEDS_INFO: 'warning',
  ACTIVE: 'success',
  REJECTED: 'danger',
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
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      await api('/masters/application', {
        method: 'POST',
        body: JSON.stringify({ ...form, experienceYears: Number(form.experienceYears), categoryIds: selectedCats }),
      });
      setEditing(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
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

  if (!loaded) {
    return (
      <div className="mx-auto max-w-sm p-6">
        <SkeletonList rows={3} label="Загрузка заявки" />
      </div>
    );
  }

  const showForm = editing || !app;
  const canUpload = app && (app.status === 'PENDING_REVIEW' || app.status === 'NEEDS_INFO');
  const canResubmit = app && (app.status === 'NEEDS_INFO' || app.status === 'REJECTED');

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
        <ArrowLeftIcon size={16} />Назад
      </Link>
      <h1 className="text-2xl font-bold text-ink">Стать мастером</h1>

      {app && !editing && (
        <Card className="space-y-3">
          <p className="flex items-center gap-2 font-bold text-ink">
            Статус: <Badge tone={STATUS_TONES[app.status]}>{STATUS_RU[app.status]}</Badge>
          </p>
          {app.status === 'REJECTED' && app.rejectionReason && (
            <Alert tone="danger" title="Причина отказа">
              {app.rejectionReason}
            </Alert>
          )}
          {app.status === 'NEEDS_INFO' && app.latestDecisionComment && (
            <Alert tone="warning" title="Что нужно дополнить">
              {app.latestDecisionComment}
            </Alert>
          )}
          {canResubmit && <Button onClick={() => setEditing(true)}>Подать заново</Button>}
        </Card>
      )}

      {showForm && (
        <div className="space-y-3">
          <Input
            label="ФИО полностью"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Input
            label="ИИН"
            hint="12 цифр"
            required
            inputMode="numeric"
            value={form.iin}
            onChange={(e) => setForm({ ...form, iin: e.target.value })}
          />
          <Input
            label="Район"
            required
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
          />
          <Input
            label="Опыт, лет"
            type="number"
            min={0}
            value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
          />
          <fieldset className="space-y-1">
            <legend className="text-sm font-bold text-ink">Категории</legend>
            {categories.map((c) => (
              <label key={c.id} className="flex min-h-11 items-center gap-2 text-base text-ink">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
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
          <Button fullWidth loading={submitting} loadingLabel="Отправляем…" onClick={submit}>
            Отправить на проверку
          </Button>
        </div>
      )}

      {canUpload && (
        <Card className="space-y-3">
          <h2 className="font-bold text-ink">Документы</h2>
          {DOC_TYPES.map((dt) => (
            <div key={dt.value} className="space-y-1">
              <label className="block text-sm font-bold text-ink">
                {dt.label}
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="mt-1 block w-full text-sm text-ink-soft file:mr-3 file:min-h-11 file:rounded-pill file:border-0 file:bg-primary file:px-4 file:font-bold file:text-on-primary"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) upload(dt.value, file);
                  }}
                />
              </label>
              <ul className="space-y-1 text-sm text-ink-soft">
                {app!.documents.filter((d) => d.type === dt.value).map((d) => (
                  <li key={d.id} className="flex items-center gap-1.5">
                    <CheckIcon size={16} className="shrink-0 text-success" />
                    {d.originalName}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
