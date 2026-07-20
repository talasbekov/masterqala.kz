import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '../../../api';
import { categoryMeta } from '../categoryMeta';

interface Category {
  id: string;
  slug: string;
  name: string;
}

const TIME_SLOTS = [
  { startH: 8, endH: 10, label: '08:00–10:00' },
  { startH: 10, endH: 13, label: '10:00–13:00' },
  { startH: 13, endH: 16, label: '13:00–16:00' },
  { startH: 16, endH: 19, label: '16:00–19:00' },
];

function nextDays(n: number): Date[] {
  const out: Date[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
}

const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export default function PlannedNewOrderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');

  const dates = nextDays(5);
  const [dateIdx, setDateIdx] = useState(0);
  const [slotIdx, setSlotIdx] = useState(1);
  const [budget, setBudget] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/categories').then(setCategories).catch((e) => setError((e as Error).message));
  }, []);

  async function addPhoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiUpload('/uploads', fd);
      setPhotoPaths((prev) => [...prev, res.path].slice(0, 5));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function slotRange(): { slotStart: string; slotEnd: string } {
    const day = dates[dateIdx];
    const slot = TIME_SLOTS[slotIdx];
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), slot.startH, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), slot.endH, 0, 0);
    return { slotStart: start.toISOString(), slotEnd: end.toISOString() };
  }

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      const { slotStart, slotEnd } = slotRange();
      const order = await api('/planned-orders', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          description,
          address,
          district,
          slotStart,
          slotEnd,
          budget: budget ? Number(budget) : undefined,
          photoPaths,
        }),
      });
      navigate(`/planned/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const header = (title: string, back: () => void, n: number) => (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={back} className="text-xl text-c2-primary">
        ←
      </button>
      <span className="flex-1 text-lg font-extrabold text-c2-ink">{title}</span>
      <span className="text-xs font-bold text-c2-ink-soft">{t('common.stepOf', { n, total: 3 })}</span>
    </div>
  );
  const progress = (n: number) => (
    <div className="flex gap-1.5">
      {[1, 2, 3].map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= n ? 'bg-c2-primary' : 'bg-c2-border'}`} />
      ))}
    </div>
  );

  if (step === 1) {
    return (
      <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
        {header(t('plannedNew.step1Title'), () => navigate('/'), 1)}
        {progress(1)}
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const meta = categoryMeta(c.slug);
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`rounded-c2-pill border-2 px-3.5 py-2 text-sm font-bold ${
                  active ? 'border-c2-primary bg-c2-primary text-white' : 'border-c2-border bg-c2-surface text-c2-ink'
                }`}
              >
                {meta.icon} {c.name}
              </button>
            );
          })}
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newOrder.step2Placeholder')}
          className="min-h-24 rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3.5 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <div key={p} className="h-16 w-16 rounded-c2-md bg-c2-fill" />
          ))}
          {photoPaths.length < 5 && (
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-c2-md border-[1.5px] border-dashed border-c2-primary text-xl text-c2-primary">
              ＋
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])}
              />
            </label>
          )}
        </div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t('plannedNew.addressLabel')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder={t('plannedNew.districtLabel')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!categoryId || !description || !address || !district}
          className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          {t('common.next')}
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
        {header(t('plannedNew.step2Title'), () => setStep(1), 2)}
        {progress(2)}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {dates.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDateIdx(i)}
              className={`flex-none rounded-c2-md border-2 px-0 py-2.5 text-center ${
                i === dateIdx ? 'border-c2-primary bg-c2-fill-soft' : 'border-c2-border bg-c2-surface'
              }`}
              style={{ width: 64 }}
            >
              <div className="text-[10.5px] font-bold text-c2-ink-soft">{DOW[d.getDay()]}</div>
              <div className="text-base font-extrabold text-c2-ink">{d.getDate()}</div>
            </button>
          ))}
        </div>
        <div className="text-sm font-extrabold text-c2-ink">{t('plannedNew.step2Slot')}</div>
        <div className="grid grid-cols-2 gap-2">
          {TIME_SLOTS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlotIdx(i)}
              className={`rounded-c2-md border-2 p-2.5 text-center text-[13px] font-bold ${
                i === slotIdx ? 'border-c2-primary bg-c2-fill-soft text-c2-primary' : 'border-c2-border text-c2-ink-soft'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="text-sm font-extrabold text-c2-ink">
          {t('plannedNew.step2Budget')} <span className="text-xs font-semibold text-c2-ink-soft">{t('plannedNew.step2BudgetHint')}</span>
        </div>
        <input
          value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder={t('plannedNew.step2BudgetPlaceholder')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm font-extrabold text-c2-ink outline-none placeholder:text-c2-muted placeholder:font-normal"
        />
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(3)}
          className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white"
        >
          {t('plannedNew.step2Next')}
        </button>
      </div>
    );
  }

  const meta = categoryMeta(categories.find((c) => c.id === categoryId)?.slug ?? '');
  const slot = TIME_SLOTS[slotIdx];
  const day = dates[dateIdx];

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      {header(t('plannedNew.step3Title'), () => setStep(2), 3)}
      {progress(3)}
      <p className="text-xs leading-relaxed text-c2-ink-soft">{t('plannedNew.step3Note')}</p>
      <div className="rounded-c2-lg border border-c2-border bg-c2-surface p-3.5 shadow-c2-card">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-c2-ink">
            {meta.icon} {categories.find((c) => c.id === categoryId)?.name}
          </span>
          <span className="rounded-c2-pill bg-c2-fill-soft px-2.5 py-1 text-[11px] font-extrabold text-c2-primary">
            {t('plannedNew.step3Offers', { n: 0 })}
          </span>
        </div>
        <div className="mt-1.5 text-[12.5px] leading-relaxed text-c2-on-fill">
          «{description}» {photoPaths.length > 0 && `· ${t('common.photosCount', { n: photoPaths.length })}`}
        </div>
        <div className="mt-1.5 text-xs text-c2-ink-soft">
          📍 {district} · 🗓 {DOW[day.getDay()]}, {day.getDate()} · {slot.label}
          {budget && ` · бюджет ~${budget} ₸`}
        </div>
      </div>
      <div className="rounded-c2-md bg-c2-fill p-3 text-xs font-semibold leading-relaxed text-c2-ink">{t('plannedNew.step3Footer')}</div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="rounded-c2-pill bg-c2-primary p-4 text-[15.5px] font-extrabold text-white disabled:opacity-40"
      >
        {t('plannedNew.publish')}
      </button>
    </div>
  );
}
