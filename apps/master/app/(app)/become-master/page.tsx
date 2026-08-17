'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, CheckIcon, Input, SkeletonList } from '@masterqala/ui';
import {
  APPLICATION_STATUS_RU,
  DOCUMENT_TYPES,
  fetchApplication,
  fetchCategories,
  submitApplication,
  uploadApplicationDocument,
  type Application,
  type Category,
} from '@/lib/masterApplication';

export default function BecomeMasterPage() {
  const [app, setApp] = useState<Application | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ fullName: '', iin: '', district: '', experienceYears: 0 });
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState('');

  async function load() {
    const cats = await fetchCategories();
    setCategories(cats);
    const a = await fetchApplication();
    setApp(a);
    if (a) {
      setForm({ fullName: a.fullName, iin: a.iin, district: a.district, experienceYears: a.experienceYears });
      setSelectedCats(a.categories.map((c) => c.category.id));
    }
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      await submitApplication({ ...form, experienceYears: Number(form.experienceYears), categoryIds: selectedCats });
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
    setUploading(type);
    try {
      await uploadApplicationDocument(type, file);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading('');
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto w-full max-w-xl p-4 sm:p-6 md:p-8">
        <SkeletonList rows={4} label="Загружаем анкету" />
      </div>
    );
  }

  const showForm = editing || !app;
  const canUpload = app && (app.status === 'PENDING_REVIEW' || app.status === 'NEEDS_INFO');
  const canResubmit = app && (app.status === 'NEEDS_INFO' || app.status === 'REJECTED');

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-extrabold text-ink">Анкета мастера</h1>

      {app && !editing && (
        <Card className="space-y-2">
          <p className="font-extrabold text-ink">Статус: {APPLICATION_STATUS_RU[app.status]}</p>
          {app.status === 'REJECTED' && app.rejectionReason && (
            <Alert tone="danger" title="Анкета отклонена">
              {app.rejectionReason}
            </Alert>
          )}
          {app.status === 'NEEDS_INFO' && app.latestDecisionComment && (
            <Alert tone="warning" title="Что нужно дополнить">
              {app.latestDecisionComment}
            </Alert>
          )}
          {canResubmit && (
            <Button size="sm" onClick={() => setEditing(true)}>
              Подать заново
            </Button>
          )}
        </Card>
      )}

      {showForm && (
        <Card padding="lg" className="space-y-3">
          <Input
            label="ФИО полностью"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Input
            label="ИИН"
            hint="12 цифр"
            inputMode="numeric"
            maxLength={12}
            value={form.iin}
            onChange={(e) => setForm({ ...form, iin: e.target.value })}
          />
          <Input
            label="Район"
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
          />
          <Input
            label="Опыт, лет"
            type="number"
            min="0"
            inputMode="numeric"
            value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
          />
          <fieldset className="space-y-1">
            <legend className="text-sm font-bold text-ink">Категории</legend>
            {categories.map((c) => (
              <label key={c.id} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={selectedCats.includes(c.id)}
                  onChange={(e) =>
                    setSelectedCats(
                      e.target.checked ? [...selectedCats, c.id] : selectedCats.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.name}
              </label>
            ))}
          </fieldset>
          <Button fullWidth loading={submitting} loadingLabel="Отправляем…" onClick={submit}>
            Отправить на проверку
          </Button>
        </Card>
      )}

      {canUpload && (
        <Card padding="lg" className="space-y-4">
          <h2 className="text-sm font-extrabold text-ink">Документы</h2>
          {DOCUMENT_TYPES.map((dt) => {
            const inputId = `doc-${dt.value}`;
            const uploaded = app!.documents.filter((d) => d.type === dt.value);
            return (
              <div key={dt.value} className="space-y-1.5">
                <label htmlFor={inputId} className="block text-sm font-bold text-ink">
                  {dt.label}
                </label>
                <input
                  id={inputId}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  disabled={uploading === dt.value}
                  className="block w-full text-sm text-ink-soft file:mr-3 file:min-h-11 file:rounded-pill file:border file:border-border-strong file:bg-surface file:px-4 file:text-sm file:font-bold file:text-ink"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) upload(dt.value, file);
                  }}
                />
                {uploaded.length > 0 && (
                  <ul className="space-y-1 text-sm text-ink-soft">
                    {uploaded.map((d) => (
                      <li key={d.id} className="flex items-center gap-1.5">
                        <CheckIcon size={16} className="shrink-0 text-success" />
                        {d.originalName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
