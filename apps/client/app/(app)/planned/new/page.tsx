'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  PhotoIcon,
  PlusIcon,
  Textarea,
} from '@masterqala/ui';
import { api, apiUpload } from '@/lib/api';
import { categoryMeta } from '@/lib/categoryMeta';

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
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [stepErrors, setStepErrors] = useState<{ description?: string; address?: string; district?: string }>({});

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

  function goToStep2() {
    const next: { description?: string; address?: string; district?: string } = {};
    if (!description.trim()) next.description = t('plannedNew.descriptionRequired');
    if (!address.trim()) next.address = t('plannedNew.addressRequired');
    if (!district.trim()) next.district = t('plannedNew.districtRequired');
    setStepErrors(next);
    if (Object.keys(next).length === 0 && categoryId) setStep(2);
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
      router.push(`/planned/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const header = (title: string, back: () => void, n: number) => (
    <div className="flex items-center gap-2.5">
      <IconButton label={t('common.back')} icon={<ArrowLeftIcon size={20} />} onClick={back} />
      <h1 className="flex-1 text-lg font-extrabold text-ink">{title}</h1>
      <span className="text-xs font-bold text-ink-soft">{t('common.stepOf', { n, total: 3 })}</span>
    </div>
  );
  const progress = (n: number) => (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={n}
      aria-label={t('common.stepOf', { n, total: 3 })}
    >
      {[1, 2, 3].map((s) => (
        <span key={s} className={`h-1.5 flex-1 rounded-full ${s <= n ? 'bg-primary' : 'bg-border'}`} />
      ))}
    </div>
  );

  if (step === 1) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
        {header(t('plannedNew.step1Title'), () => router.push('/'), 1)}
        {progress(1)}
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('home.categoriesTitle')}>
          {categories.map((c) => {
            const { Icon } = categoryMeta(c.slug);
            const active = c.id === categoryId;
            return (
              <Button
                key={c.id}
                size="sm"
                variant={active ? 'primary' : 'secondary'}
                aria-pressed={active}
                icon={<Icon size={18} />}
                onClick={() => setCategoryId(c.id)}
              >
                {c.name}
              </Button>
            );
          })}
        </div>
        <Textarea
          label={t('newOrder.step2Title')}
          rows={4}
          required
          value={description}
          error={stepErrors.description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newOrder.step2Placeholder')}
        />
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <span key={p} className="flex size-16 items-center justify-center rounded-md bg-fill text-ink-soft">
              <PhotoIcon size={20} />
            </span>
          ))}
          {photoPaths.length < 5 && (
            <label className="flex size-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-primary text-primary">
              <PlusIcon size={22} />
              <span className="sr-only">{t('newOrder.addPhoto')}</span>
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
          value={address}
          error={stepErrors.address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <Input
          label={t('plannedNew.districtLabel')}
          required
          value={district}
          error={stepErrors.district}
          onChange={(e) => setDistrict(e.target.value)}
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="mt-auto" />
        <Button size="lg" fullWidth disabled={!categoryId} onClick={goToStep2}>
          {t('common.next')}
        </Button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
        {header(t('plannedNew.step2Title'), () => setStep(1), 2)}
        {progress(2)}
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('plannedNew.step2Title')}>
          {dates.map((d, i) => (
            <Button
              key={i}
              variant={i === dateIdx ? 'primary' : 'secondary'}
              aria-pressed={i === dateIdx}
              className="w-16 flex-none"
              onClick={() => setDateIdx(i)}
            >
              <span className="flex flex-col leading-tight">
                <span className="text-2xs font-bold">{DOW[d.getDay()]}</span>
                <span className="text-base font-extrabold">{d.getDate()}</span>
              </span>
            </Button>
          ))}
        </div>
        <p className="text-sm font-extrabold text-ink">{t('plannedNew.step2Slot')}</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('plannedNew.step2Slot')}>
          {TIME_SLOTS.map((s, i) => (
            <Button
              key={i}
              variant={i === slotIdx ? 'primary' : 'secondary'}
              fullWidth
              aria-pressed={i === slotIdx}
              onClick={() => setSlotIdx(i)}
            >
              {s.label}
            </Button>
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
        <Button size="lg" fullWidth onClick={() => setStep(3)}>
          {t('plannedNew.step2Next')}
        </Button>
      </div>
    );
  }

  const { Icon } = categoryMeta(categories.find((c) => c.id === categoryId)?.slug ?? '');
  const slot = TIME_SLOTS[slotIdx];
  const day = dates[dateIdx];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      {header(t('plannedNew.step3Title'), () => setStep(2), 3)}
      {progress(3)}
      <p className="text-xs leading-relaxed text-ink-soft">{t('plannedNew.step3Note')}</p>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <Icon size={20} className="text-primary" />
            {categories.find((c) => c.id === categoryId)?.name}
          </span>
          <Badge tone="primary">{t('plannedNew.step3Offers', { n: 0 })}</Badge>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-on-fill">
          «{description}» {photoPaths.length > 0 && `· ${t('common.photosCount', { n: photoPaths.length })}`}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
          <span className="flex items-center gap-1">
            <MapPinIcon size={14} />
            {district}
          </span>
          <span className="flex items-center gap-1">
            <CalendarIcon size={14} />
            {DOW[day.getDay()]}, {day.getDate()} · {slot.label}
          </span>
          {budget && <span>· бюджет ~{budget} ₸</span>}
        </p>
      </Card>
      <p className="rounded-md bg-surface-sunken p-3 text-xs leading-relaxed font-semibold text-on-fill">
        {t('plannedNew.step3Footer')}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      <Button size="lg" fullWidth loading={submitting} onClick={submit}>
        {t('plannedNew.publish')}
      </Button>
    </div>
  );
}
