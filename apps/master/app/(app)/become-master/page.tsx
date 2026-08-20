'use client';
import { useEffect, useState } from 'react';
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
    try {
      await submitApplication({ ...form, experienceYears: Number(form.experienceYears), categoryIds: selectedCats });
      setEditing(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function upload(type: string, file: File) {
    setError('');
    try {
      await uploadApplicationDocument(type, file);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!loaded) return <p className="p-8 text-ink-soft">Загрузка…</p>;

  const showForm = editing || !app;
  const canUpload = app && (app.status === 'PENDING_REVIEW' || app.status === 'NEEDS_INFO');
  const canResubmit = app && (app.status === 'NEEDS_INFO' || app.status === 'REJECTED');

  return (
    <div className="mx-auto max-w-[560px] space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-extrabold text-ink">Анкета мастера</h1>

      {app?.blockedUntil && new Date(app.blockedUntil) > new Date() && (
        <div className="rounded-lg bg-danger-bg p-4">
          <div className="text-sm font-extrabold text-danger-ink">
            ⛔ Доступ к новым заявкам ограничен до{' '}
            {new Date(app.blockedUntil).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-danger-ink">
            Причина: 3 отмены заказов за 30 дней. Текущий активный заказ можно завершить. Вопросы — в поддержку.
          </p>
        </div>
      )}

      {app && !editing && (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <p className="font-extrabold text-ink">Статус: {APPLICATION_STATUS_RU[app.status]}</p>
          {app.status === 'REJECTED' && app.rejectionReason && (
            <p className="text-sm text-danger">Причина: {app.rejectionReason}</p>
          )}
          {app.status === 'NEEDS_INFO' && app.latestDecisionComment && (
            <p className="text-sm text-ink-soft">Что нужно дополнить: {app.latestDecisionComment}</p>
          )}
          {canResubmit && (
            <button
              className="rounded-pill bg-primary px-4 py-2 text-sm font-extrabold text-white"
              onClick={() => setEditing(true)}
            >
              Подать заново
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
          <input
            className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
            placeholder="ФИО полностью"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <input
            className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
            placeholder="ИИН (12 цифр)"
            value={form.iin}
            onChange={(e) => setForm({ ...form, iin: e.target.value })}
          />
          <input
            className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
            placeholder="Район"
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
          />
          <input
            className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
            type="number"
            placeholder="Опыт, лет"
            value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
          />
          <fieldset className="space-y-1">
            <legend className="text-sm font-extrabold text-ink">Категории</legend>
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
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
          <button
            className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white"
            onClick={submit}
          >
            Отправить на проверку
          </button>
        </div>
      )}

      {canUpload && (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-extrabold text-ink">Документы</h2>
          {DOCUMENT_TYPES.map((dt) => (
            <div key={dt.value}>
              <label className="block text-sm text-ink-soft">{dt.label}</label>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) upload(dt.value, file);
                }}
              />
              <ul className="text-sm text-ink-soft">
                {app!.documents.filter((d) => d.type === dt.value).map((d) => (
                  <li key={d.id}>✓ {d.originalName}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
