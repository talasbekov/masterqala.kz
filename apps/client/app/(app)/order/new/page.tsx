'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
    <div className="flex gap-1.5">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-border'}`} />
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
      <button type="button" onClick={goBack} className="text-xl text-primary">
        ←
      </button>
      <span className="flex-1 text-lg font-extrabold text-ink">{stepTitles[step]}</span>
      <span className="text-xs font-bold text-ink-soft">{t('common.stepOf', { n: step, total: 4 })}</span>
    </div>
  );

  let stepContent: React.ReactNode;

  if (step === 1) {
    stepContent = (
      <>
        <div className="text-xl font-extrabold text-ink">{t('newOrder.step1Question')}</div>
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((c) => {
            const meta = categoryMeta(c.slug);
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`rounded-md border-2 p-3.5 text-left ${
                  active ? 'border-primary bg-fill-soft' : 'border-border bg-surface'
                }`}
              >
                <div className="mb-1.5 text-xl">{meta.icon}</div>
                <div className="text-sm font-extrabold text-ink">{c.name}</div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => router.push('/support')}
          className="rounded-md border-[1.5px] border-dashed border-border p-3 text-[13px] font-bold text-ink-soft"
        >
          {t('newOrder.step1Unknown')}
        </button>
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!categoryId}
          className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          {t('common.next')}
        </button>
      </>
    );
  } else if (step === 2) {
    stepContent = (
      <>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newOrder.step2Placeholder')}
          className="min-h-28 rounded-md border-[1.5px] border-border bg-surface p-3.5 text-sm text-ink outline-none placeholder:text-muted"
        />
        <div className="text-sm font-extrabold text-ink">
          {t('newOrder.step2PhotosLabel')} <span className="text-xs font-semibold text-ink-soft">{t('newOrder.step2PhotosHint')}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <div key={p} className="h-18 w-18 rounded-md bg-fill" />
          ))}
          {photoPaths.length < 5 && (
            <label className="flex h-18 w-18 cursor-pointer items-center justify-center rounded-md border-[1.5px] border-dashed border-primary text-2xl text-primary">
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
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(3)}
          className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white"
        >
          {t('newOrder.step2Next')}
        </button>
      </>
    );
  } else if (step === 3) {
    stepContent = (
      <>
        <input
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          placeholder={t('newOrder.step3Title')}
          className="rounded-md border-[1.5px] border-primary bg-surface p-3 text-sm font-bold text-ink outline-none"
        />
        {savedAddresses.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {savedAddresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => selectAddress(a)}
                className="rounded-pill border-[1.5px] border-border px-3 py-1.5 text-xs font-bold text-ink-soft"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border-[1.5px] border-border bg-surface p-2.5">
            <div className="text-[10px] font-bold text-ink-soft">{t('newOrder.step3Entrance')}</div>
            <input
              value={entrance}
              onChange={(e) => setEntrance(e.target.value)}
              className="w-full bg-transparent text-sm font-extrabold text-ink outline-none"
            />
          </div>
          <div className="rounded-md border-[1.5px] border-border bg-surface p-2.5">
            <div className="text-[10px] font-bold text-ink-soft">{t('newOrder.step3Floor')}</div>
            <input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="w-full bg-transparent text-sm font-extrabold text-ink outline-none"
            />
          </div>
          <div className="rounded-md border-[1.5px] border-border bg-surface p-2.5">
            <div className="text-[10px] font-bold text-ink-soft">{t('newOrder.step3Apartment')}</div>
            <input
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              className="w-full bg-transparent text-sm font-extrabold text-ink outline-none"
            />
          </div>
        </div>
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder={t('newOrder.step3District')}
          className="rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
        />
        <input
          value={addressComment}
          onChange={(e) => setAddressComment(e.target.value)}
          placeholder={t('newOrder.step3Comment')}
          className="rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition((pos) =>
              setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            )
          }
          className="rounded-pill border-[1.5px] border-border p-2.5 text-xs font-extrabold text-ink-soft"
        >
          ◎ {t('newOrder.step3MyLocation')}
        </button>
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(4)}
          disabled={!addressText || !district}
          className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          {t('newOrder.step3Next')}
        </button>
      </>
    );
  } else {
    stepContent = (
      <>
        <div className="rounded-md bg-fill p-3.5">
          <div className="text-sm font-extrabold text-ink">
            {categoryMeta(categories.find((c) => c.id === categoryId)?.slug ?? '').icon}{' '}
            {categories.find((c) => c.id === categoryId)?.name} · «{description.slice(0, 40)}» ·{' '}
            {t('common.photosCount', { n: photoPaths.length })}
          </div>
          <div className="mt-1 text-xs font-semibold text-on-fill">
            {addressText} · {t('newOrder.step3Entrance')} {entrance} · {t('newOrder.step3Floor')} {floor} · {t('newOrder.step3Apartment')} {apartment}
          </div>
        </div>
        {preview?.available === false && <p className="text-sm font-semibold text-danger">{t('newOrder.unavailable')}</p>}
        {preview?.available && (
          <div className="rounded-lg border border-border bg-surface p-3.5">
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
            <div className="text-xs leading-relaxed text-on-fill">
              {paymentsEnabled
                ? t('newOrder.step4Note')
                : 'Выезд в бесплатном пилоте не оплачивается. Стоимость работ мастер назовёт после осмотра; вы подтвердите её и рассчитаетесь с мастером напрямую.'}
            </div>
          </div>
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
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !preview?.available}
          className="rounded-pill bg-primary p-4 text-[15.5px] font-extrabold text-white disabled:opacity-40"
        >
          {paymentsEnabled ? t('newOrder.step4Submit', { price: preview?.calloutPrice ?? '' }) : 'Найти мастера бесплатно'}
        </button>
      </>
    );
  }

  return (
    <div className="mx-auto flex h-screen max-w-6xl flex-col gap-4 px-8 py-6">
      {header}
      {progress}
      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="flex w-[560px] shrink-0 flex-col gap-3 overflow-y-auto pb-2">{stepContent}</div>
        <div className="flex-1 overflow-hidden rounded-lg">
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
