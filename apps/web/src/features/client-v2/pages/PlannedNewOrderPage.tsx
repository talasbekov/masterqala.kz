import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ArrowLeftIcon,
  Badge,
  Button,
  CalendarIcon,
  Card,
  IconButton,
  Input,
  MapPinIcon,
  PlusIcon,
  Textarea,
} from '@masterqala/ui';
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
      <IconButton label={t('common.back')} icon={<ArrowLeftIcon />} onClick={back} />
      <h1 className="flex-1 text-lg font-extrabold text-ink">{title}</h1>
      <span className="text-xs font-bold text-ink-soft">{t('common.stepOf', { n, total: 3 })}</span>
    </div>
  );
  const progress = (n: number) => (
    <div className="flex gap-1.5">
      {[1, 2, 3].map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= n ? 'bg-primary' : 'bg-border'}`} />
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
                aria-pressed={active}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-pill border-2 px-3.5 py-2 text-sm font-bold ${
                  active
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-strong bg-surface text-ink'
                }`}
              >
                {meta.icon} {c.name}
              </button>
            );
          })}
        </div>
        <Textarea
          label={t('newOrder.step2Title')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newOrder.step2Placeholder')}
          className="min-h-24"
        />
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <div key={p} className="h-16 w-16 rounded-md bg-fill" />
          ))}
          {photoPaths.length < 5 && (
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-primary text-primary">
              <PlusIcon size={22} />
              <span className="sr-only">{t('common.addPhoto')}</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => e.target.files?.[0] && addPhoto(e.target.files[0])}
              />
            </label>
          )}
        </div>
        <Input
          label={t('plannedNew.addressLabel')}
          required
          autoComplete="street-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <Input
          label={t('plannedNew.districtLabel')}
          required
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="mt-auto" />
        <Button
          fullWidth
          size="lg"
          disabled={!categoryId || !description || !address || !district}
          onClick={() => setStep(2)}
        >
          {t('common.next')}
        </Button>
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
              aria-pressed={i === dateIdx}
              className={`min-h-11 flex-none rounded-md border-2 px-0 py-2.5 text-center ${
                i === dateIdx ? 'border-primary bg-fill-soft' : 'border-border-strong bg-surface'
              }`}
              style={{ width: 64 }}
            >
              <div className="text-2xs font-bold text-ink-soft">{DOW[d.getDay()]}</div>
              <div className="text-base font-extrabold text-ink">{d.getDate()}</div>
            </button>
          ))}
        </div>
        <div className="text-sm font-extrabold text-ink">{t('plannedNew.step2Slot')}</div>
        <div className="grid grid-cols-2 gap-2">
          {TIME_SLOTS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlotIdx(i)}
              aria-pressed={i === slotIdx}
              className={`min-h-11 rounded-md border-2 p-2.5 text-center text-xs font-bold ${
                i === slotIdx ? 'border-primary bg-fill-soft text-primary' : 'border-border-strong text-ink-soft'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Input
          label={t('plannedNew.step2Budget')}
          hint={t('plannedNew.step2BudgetHint')}
          value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder={t('plannedNew.step2BudgetPlaceholder')}
        />
        <div className="mt-auto" />
        <Button fullWidth size="lg" onClick={() => setStep(3)}>
          {t('plannedNew.step2Next')}
        </Button>
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
      <p className="text-xs leading-relaxed text-ink-soft">{t('plannedNew.step3Note')}</p>
      <Card padding="sm" raised>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <span className="shrink-0 text-primary">{meta.icon}</span>
            {categories.find((c) => c.id === categoryId)?.name}
          </span>
          <Badge tone="primary">{t('plannedNew.step3Offers', { n: 0 })}</Badge>
        </div>
        <div className="mt-1.5 text-xs leading-relaxed text-on-fill">
          «{description}» {photoPaths.length > 0 && `· ${t('common.photosCount', { n: photoPaths.length })}`}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
          <MapPinIcon size={14} />
          {district} ·
          <CalendarIcon size={14} />
          {DOW[day.getDay()]}, {day.getDate()} · {slot.label}
          {budget && ` · бюджет ~${budget} ₸`}
        </div>
      </Card>
      <div className="rounded-md bg-fill p-3 text-xs font-semibold leading-relaxed text-ink">{t('plannedNew.step3Footer')}</div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <Button fullWidth size="lg" loading={submitting} onClick={submit}>
        {t('plannedNew.publish')}
      </Button>
    </div>
  );
}
