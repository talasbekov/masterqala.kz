'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ArrowLeftIcon,
  Button,
  Card,
  IconButton,
  Input,
  MapPinIcon,
  PhotoIcon,
  PlusIcon,
  Textarea,
} from '@masterqala/ui';
import { api, apiUpload } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';
import { categoryMeta } from '@/lib/categoryMeta';
import MapView, { type LatLng } from '@/components/MapView';

interface Category {
  id: string;
  slug: string;
  name: string;
}
interface Address {
  id: string;
  label: string;
  address: string;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  lat: number | null;
  lng: number | null;
}
interface Preview {
  available: boolean;
  calloutPrice?: number;
  serviceFee?: number;
}

const ASTANA_CENTER: LatLng = { lat: 51.1605, lng: 71.4704 };

export default function NewOrderPage() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useCommercialMode();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');

  const [description, setDescription] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [geo, setGeo] = useState<LatLng>(ASTANA_CENTER);
  const [addressText, setAddressText] = useState('');
  const [district, setDistrict] = useState('');
  const [entrance, setEntrance] = useState('');
  const [floor, setFloor] = useState('');
  const [apartment, setApartment] = useState('');
  const [addressComment, setAddressComment] = useState('');
  const [addressErrors, setAddressErrors] = useState<{ address?: string; district?: string }>({});

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/categories').then(setCategories).catch((e) => setError((e as Error).message));
    api('/addresses').then(setSavedAddresses).catch(() => {});
    navigator.geolocation?.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError(t('newOrder.geoError')),
    );
  }, [t]);

  useEffect(() => {
    if (step !== 4 || !categoryId) return;
    api('/orders/preview', { method: 'POST', body: JSON.stringify({ categoryId, lat: geo.lat, lng: geo.lng }) })
      .then(setPreview)
      .catch((e) => setError((e as Error).message));
  }, [step, categoryId, geo]);

  function selectAddress(a: Address) {
    setAddressText(a.address);
    setEntrance(a.entrance ?? '');
    setFloor(a.floor ?? '');
    setApartment(a.apartment ?? '');
    if (a.lat != null && a.lng != null) setGeo({ lat: a.lat, lng: a.lng });
  }

  function goToStep4() {
    const next: { address?: string; district?: string } = {};
    if (!addressText.trim()) next.address = t('newOrder.addressRequired');
    if (!district.trim()) next.district = t('newOrder.districtRequired');
    setAddressErrors(next);
    if (Object.keys(next).length === 0) setStep(4);
  }

  async function addPhoto(file: File) {
    setUploading(true);
    try {
      const res = await apiUpload('/uploads', (() => {
        const fd = new FormData();
        fd.append('file', file);
        return fd;
      })());
      setPhotoPaths((prev) => [...prev, res.path].slice(0, 5));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError('');
    setSubmitting(true);
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          description,
          address: addressText,
          district,
          entrance: entrance || undefined,
          floor: floor || undefined,
          apartment: apartment || undefined,
          addressComment: addressComment || undefined,
          photoPaths,
          lat: geo.lat,
          lng: geo.lng,
        }),
      });
      router.push(`/order/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const progress = (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={step}
      aria-label={t('common.stepOf', { n: step, total: 4 })}
    >
      {[1, 2, 3, 4].map((s) => (
        <span key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-urgent' : 'bg-border'}`} />
      ))}
    </div>
  );

  const stepTitles: Record<1 | 2 | 3 | 4, string> = {
    1: t('newOrder.step1Title'),
    2: t('newOrder.step2Title'),
    3: t('newOrder.step3Title'),
    4: t('newOrder.step4Title'),
  };

  const goBack = () => {
    if (step === 1) router.push('/');
    else setStep((step - 1) as 1 | 2 | 3);
  };

  const header = (
    <div className="flex items-center gap-2.5">
      <IconButton label={t('common.back')} icon={<ArrowLeftIcon size={20} />} onClick={goBack} />
      <h1 className="flex-1 text-lg font-extrabold text-ink">{stepTitles[step]}</h1>
      <span className="text-xs font-bold text-ink-soft">{t('common.stepOf', { n: step, total: 4 })}</span>
    </div>
  );

  const photoPicker = (
    <div className="flex flex-wrap gap-2.5">
      {photoPaths.map((p) => (
        <span key={p} className="flex size-18 items-center justify-center rounded-md bg-fill text-ink-soft">
          <PhotoIcon size={22} />
        </span>
      ))}
      {photoPaths.length < 5 && (
        <label className="flex size-18 cursor-pointer items-center justify-center rounded-md border border-dashed border-primary text-primary">
          <PlusIcon size={24} />
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
  );

  let stepContent: React.ReactNode;

  if (step === 1) {
    stepContent = (
      <>
        <p className="text-xl font-extrabold text-ink">{t('newOrder.step1Question')}</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {categories.map((c) => {
            const { Icon } = categoryMeta(c.slug);
            const active = c.id === categoryId;
            return (
              <Button
                key={c.id}
                variant={active ? 'primary' : 'secondary'}
                fullWidth
                aria-pressed={active}
                icon={<Icon size={20} />}
                onClick={() => setCategoryId(c.id)}
              >
                {c.name}
              </Button>
            );
          })}
        </div>
        <Button variant="ghost" fullWidth onClick={() => router.push('/support')}>
          {t('newOrder.step1Unknown')}
        </Button>
        <div className="mt-auto" />
        <Button variant="urgent" size="lg" fullWidth disabled={!categoryId} onClick={() => setStep(2)}>
          {t('common.next')}
        </Button>
      </>
    );
  } else if (step === 2) {
    stepContent = (
      <>
        <Textarea
          label={t('newOrder.step2Title')}
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newOrder.step2Placeholder')}
        />
        <p className="text-sm font-extrabold text-ink">
          {t('newOrder.step2PhotosLabel')}{' '}
          <span className="text-xs font-semibold text-ink-soft">{t('newOrder.step2PhotosHint')}</span>
        </p>
        {photoPicker}
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="mt-auto" />
        <Button variant="urgent" size="lg" fullWidth onClick={() => setStep(3)}>
          {t('newOrder.step2Next')}
        </Button>
      </>
    );
  } else if (step === 3) {
    stepContent = (
      <>
        <Input
          label={t('newOrder.step3Title')}
          required
          value={addressText}
          error={addressErrors.address}
          onChange={(e) => setAddressText(e.target.value)}
        />
        {savedAddresses.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {savedAddresses.map((a) => (
              <Button key={a.id} size="sm" variant="secondary" onClick={() => selectAddress(a)}>
                {a.label}
              </Button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Input
            label={t('newOrder.step3Entrance')}
            value={entrance}
            inputMode="numeric"
            onChange={(e) => setEntrance(e.target.value)}
          />
          <Input
            label={t('newOrder.step3Floor')}
            value={floor}
            inputMode="numeric"
            onChange={(e) => setFloor(e.target.value)}
          />
          <Input
            label={t('newOrder.step3Apartment')}
            value={apartment}
            inputMode="numeric"
            onChange={(e) => setApartment(e.target.value)}
          />
        </div>
        <Input
          label={t('newOrder.step3District')}
          required
          value={district}
          error={addressErrors.district}
          onChange={(e) => setDistrict(e.target.value)}
        />
        <Input
          label={t('newOrder.step3CommentLabel')}
          value={addressComment}
          onChange={(e) => setAddressComment(e.target.value)}
          placeholder={t('newOrder.step3Comment')}
        />
        <Button
          variant="secondary"
          fullWidth
          icon={<MapPinIcon size={18} />}
          onClick={() =>
            navigator.geolocation?.getCurrentPosition((pos) =>
              setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            )
          }
        >
          {t('newOrder.step3MyLocation')}
        </Button>
        <div className="mt-auto" />
        <Button variant="urgent" size="lg" fullWidth onClick={goToStep4}>
          {t('newOrder.step3Next')}
        </Button>
      </>
    );
  } else {
    const selected = categories.find((c) => c.id === categoryId);
    const { Icon } = categoryMeta(selected?.slug ?? '');
    stepContent = (
      <>
        <div className="rounded-md bg-surface-sunken p-3.5">
          <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <Icon size={20} className="shrink-0 text-primary" />
            <span>
              {selected?.name} · «{description.slice(0, 40)}» · {t('common.photosCount', { n: photoPaths.length })}
            </span>
          </p>
          <p className="mt-1 text-xs font-semibold text-on-fill">
            {addressText} · {t('newOrder.step3Entrance')} {entrance} · {t('newOrder.step3Floor')} {floor} ·{' '}
            {t('newOrder.step3Apartment')} {apartment}
          </p>
        </div>
        {preview?.available === false && <Alert tone="warning">{t('newOrder.unavailable')}</Alert>}
        {preview?.available && (
          <Card>
            <div className="flex justify-between text-sm font-bold text-ink">
              <span>{t('newOrder.step4CalloutLabel')}</span>
              <span className="font-extrabold">{preview.calloutPrice} ₸</span>
            </div>
            {paymentsEnabled && (
              <div className="mt-1 flex justify-between text-xs text-ink-soft">
                <span>{t('newOrder.step4FeeLabel')}</span>
                <span>{preview.serviceFee} ₸</span>
              </div>
            )}
            <div className="my-2.5 border-t border-dashed border-border" />
            <p className="text-xs leading-relaxed text-on-fill">
              {paymentsEnabled
                ? t('newOrder.step4Note')
                : 'Выезд в бесплатном пилоте не оплачивается. Стоимость работ мастер назовёт после осмотра; вы подтвердите её и рассчитаетесь с мастером напрямую.'}
            </p>
          </Card>
        )}
        <div className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
          <span className="text-sm font-extrabold text-ink">
            {paymentsEnabled ? t('newOrder.step4PaymentMethod') : 'Бесплатный пилот · без привязки карты'}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-ink-soft">
          {paymentsEnabled
            ? t('newOrder.step4CancelNote')
            : 'Отмена до начала работ не вызывает списаний со стороны платформы. Договорённости по фактическим расходам обсуждаются напрямую с мастером.'}
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="mt-auto" />
        <Button
          variant="urgent"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!preview?.available}
          onClick={submit}
        >
          {paymentsEnabled ? t('newOrder.step4Submit', { price: preview?.calloutPrice ?? '' }) : 'Найти мастера бесплатно'}
        </Button>
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-6 sm:px-8 lg:h-screen">
      {header}
      {progress}
      {/* Ниже lg карта уходит под форму: колонка в 560px не помещалась. */}
      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:overflow-hidden">
        <div className="flex flex-col gap-3 pb-2 lg:w-[560px] lg:shrink-0 lg:overflow-y-auto">{stepContent}</div>
        <div className="h-64 overflow-hidden rounded-lg lg:h-auto lg:flex-1">
          <MapView
            mode="pin"
            center={geo}
            onCenterChange={step === 3 ? setGeo : undefined}
            height={undefined}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
