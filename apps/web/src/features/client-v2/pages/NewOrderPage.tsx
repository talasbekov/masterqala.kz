import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '../../../api';
import { categoryMeta } from '../categoryMeta';
import MapView, { type LatLng } from '../components/MapView';

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
  const navigate = useNavigate();
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
      navigate(`/order/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const progress = (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-c2-primary' : 'bg-c2-border'}`} />
      ))}
    </div>
  );

  const header = (title: string, back: () => void) => (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={back} className="text-xl text-c2-primary">
        ←
      </button>
      <span className="flex-1 text-lg font-extrabold text-c2-ink">{title}</span>
      <span className="text-xs font-bold text-c2-ink-soft">
        {t('common.stepOf', { n: step, total: 4 })}
      </span>
    </div>
  );

  if (step === 1) {
    return (
      <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
        {header(t('newOrder.step1Title'), () => navigate('/'))}
        {progress}
        <div className="text-xl font-extrabold text-c2-ink">{t('newOrder.step1Question')}</div>
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((c) => {
            const meta = categoryMeta(c.slug);
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`rounded-c2-md border-2 p-3.5 text-left ${
                  active ? 'border-c2-primary bg-c2-fill-soft' : 'border-c2-border bg-c2-surface'
                }`}
              >
                <div className="mb-1.5 text-xl">{meta.icon}</div>
                <div className="text-sm font-extrabold text-c2-ink">{c.name}</div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => navigate('/support')}
          className="rounded-c2-md border-[1.5px] border-dashed border-c2-border p-3 text-[13px] font-bold text-c2-ink-soft"
        >
          {t('newOrder.step1Unknown')}
        </button>
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!categoryId}
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
        {header(t('newOrder.step2Title'), () => setStep(1))}
        {progress}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newOrder.step2Placeholder')}
          className="min-h-28 rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3.5 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <div className="text-sm font-extrabold text-c2-ink">
          {t('newOrder.step2PhotosLabel')} <span className="text-xs font-semibold text-c2-ink-soft">{t('newOrder.step2PhotosHint')}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <div key={p} className="h-18 w-18 rounded-c2-md bg-c2-fill" />
          ))}
          {photoPaths.length < 5 && (
            <label className="flex h-18 w-18 cursor-pointer items-center justify-center rounded-c2-md border-[1.5px] border-dashed border-c2-primary text-2xl text-c2-primary">
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
        {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(3)}
          className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white"
        >
          {t('newOrder.step2Next')}
        </button>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="flex flex-col gap-3 pb-3.5">
        <div className="relative">
          <MapView mode="pin" center={geo} onCenterChange={setGeo} height={190} />
          <button
            type="button"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((pos) =>
                setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              )
            }
            className="absolute bottom-3 right-3 rounded-c2-pill bg-white px-3 py-2 text-xs font-extrabold text-c2-ink shadow-c2-card"
          >
            ◎ {t('newOrder.step3MyLocation')}
          </button>
        </div>
        <div className="flex flex-col gap-2.5 px-5">
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-c2-ink">{t('newOrder.step3Title')}</span>
            <span className="text-xs font-bold text-c2-ink-soft">{t('common.stepOf', { n: 3, total: 4 })}</span>
          </div>
          <input
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder={t('newOrder.step3Title')}
            className="rounded-c2-md border-[1.5px] border-c2-primary bg-c2-surface p-3 text-sm font-bold text-c2-ink outline-none"
          />
          {savedAddresses.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedAddresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => selectAddress(a)}
                  className="rounded-c2-pill border-[1.5px] border-c2-border px-3 py-1.5 text-xs font-bold text-c2-ink-soft"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5">
              <div className="text-[10px] font-bold text-c2-ink-soft">{t('newOrder.step3Entrance')}</div>
              <input
                value={entrance}
                onChange={(e) => setEntrance(e.target.value)}
                className="w-full bg-transparent text-sm font-extrabold text-c2-ink outline-none"
              />
            </div>
            <div className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5">
              <div className="text-[10px] font-bold text-c2-ink-soft">{t('newOrder.step3Floor')}</div>
              <input
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full bg-transparent text-sm font-extrabold text-c2-ink outline-none"
              />
            </div>
            <div className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5">
              <div className="text-[10px] font-bold text-c2-ink-soft">{t('newOrder.step3Apartment')}</div>
              <input
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
                className="w-full bg-transparent text-sm font-extrabold text-c2-ink outline-none"
              />
            </div>
          </div>
          <input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder={t('newOrder.step3District')}
            className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
          <input
            value={addressComment}
            onChange={(e) => setAddressComment(e.target.value)}
            placeholder={t('newOrder.step3Comment')}
            className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
          <button
            type="button"
            onClick={() => setStep(4)}
            disabled={!addressText || !district}
            className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
          >
            {t('newOrder.step3Next')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      {header(t('newOrder.step4Title'), () => setStep(3))}
      {progress}
      <div className="rounded-c2-md bg-c2-fill p-3.5">
        <div className="text-sm font-extrabold text-c2-ink">
          {categoryMeta(categories.find((c) => c.id === categoryId)?.slug ?? '').icon}{' '}
          {categories.find((c) => c.id === categoryId)?.name} · «{description.slice(0, 40)}» ·{' '}
          {t('common.photosCount', { n: photoPaths.length })}
        </div>
        <div className="mt-1 text-xs font-semibold text-c2-on-fill">
          {addressText} · {t('newOrder.step3Entrance')} {entrance} · {t('newOrder.step3Floor')} {floor} · {t('newOrder.step3Apartment')} {apartment}
        </div>
      </div>
      {preview?.available === false && <p className="text-sm font-semibold text-c2-danger">{t('newOrder.unavailable')}</p>}
      {preview?.available && (
        <div className="rounded-c2-lg border border-c2-border bg-c2-surface p-3.5">
          <div className="flex justify-between text-sm font-bold text-c2-ink">
            <span>{t('newOrder.step4CalloutLabel')}</span>
            <span className="font-extrabold">{preview.calloutPrice} ₸</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-c2-ink-soft">
            <span>{t('newOrder.step4FeeLabel')}</span>
            <span>{preview.serviceFee} ₸</span>
          </div>
          <div className="my-2.5 border-t border-dashed border-c2-border" />
          <div className="text-xs leading-relaxed text-c2-on-fill">{t('newOrder.step4Note')}</div>
        </div>
      )}
      <div className="flex items-center justify-between rounded-c2-md border border-c2-border bg-c2-surface p-3">
        <span className="text-sm font-extrabold text-c2-ink">{t('newOrder.step4PaymentMethod')}</span>
      </div>
      <p className="text-xs leading-relaxed text-c2-ink-soft">{t('newOrder.step4CancelNote')}</p>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={submit}
        disabled={submitting || !preview?.available}
        className="rounded-c2-pill bg-c2-primary p-4 text-[15.5px] font-extrabold text-white disabled:opacity-40"
      >
        {t('newOrder.step4Submit', { price: preview?.calloutPrice ?? '' })}
      </button>
    </div>
  );
}
