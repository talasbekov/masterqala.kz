import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ArrowLeftIcon,
  Button,
  Card,
  IconButton,
  Input,
  MapPinIcon,
  PlusIcon,
  Textarea,
} from '@masterqala/ui';
import { api, apiUpload } from '../../../api';
import { useCommercialMode } from '../../../commercial-mode';
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
  const { paymentsEnabled } = useCommercialMode();
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
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-border'}`} />
      ))}
    </div>
  );

  const header = (title: string, back: () => void) => (
    <div className="flex items-center gap-2.5">
      <IconButton label={t('common.back')} icon={<ArrowLeftIcon />} onClick={back} />
      <h1 className="flex-1 text-lg font-extrabold text-ink">{title}</h1>
      <span className="text-xs font-bold text-ink-soft">
        {t('common.stepOf', { n: step, total: 4 })}
      </span>
    </div>
  );

  if (step === 1) {
    return (
      <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
        {header(t('newOrder.step1Title'), () => navigate('/'))}
        {progress}
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
                aria-pressed={active}
                className={`min-h-11 rounded-md border-2 p-3.5 text-left ${
                  active ? 'border-primary bg-fill-soft' : 'border-border-strong bg-surface'
                }`}
              >
                <div className="mb-1.5 text-primary">{meta.icon}</div>
                <div className="text-sm font-extrabold text-ink">{c.name}</div>
              </button>
            );
          })}
        </div>
        <Button fullWidth variant="secondary" onClick={() => navigate('/support')}>
          {t('newOrder.step1Unknown')}
        </Button>
        <div className="mt-auto" />
        <Button fullWidth size="lg" disabled={!categoryId} onClick={() => setStep(2)}>
          {t('common.next')}
        </Button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
        {header(t('newOrder.step2Title'), () => setStep(1))}
        {progress}
        <Textarea
          label={t('newOrder.step2Title')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('newOrder.step2Placeholder')}
          className="min-h-28"
        />
        <div className="text-sm font-extrabold text-ink">
          {t('newOrder.step2PhotosLabel')} <span className="text-xs font-semibold text-ink-soft">{t('newOrder.step2PhotosHint')}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <div key={p} className="h-18 w-18 rounded-md bg-fill" />
          ))}
          {photoPaths.length < 5 && (
            <label className="flex h-18 w-18 cursor-pointer items-center justify-center rounded-md border border-dashed border-primary text-primary">
              <PlusIcon size={24} />
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
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="mt-auto" />
        <Button fullWidth size="lg" onClick={() => setStep(3)}>
          {t('newOrder.step2Next')}
        </Button>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="flex flex-col gap-3 pb-3.5">
        <div className="relative">
          <MapView mode="pin" center={geo} onCenterChange={setGeo} height={190} />
          <Button
            variant="secondary"
            size="sm"
            icon={<MapPinIcon size={16} />}
            className="absolute bottom-3 right-3 shadow-card"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((pos) =>
                setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              )
            }
          >
            {t('newOrder.step3MyLocation')}
          </Button>
        </div>
        <div className="flex flex-col gap-2.5 px-5">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-extrabold text-ink">{t('newOrder.step3Title')}</h1>
            <span className="text-xs font-bold text-ink-soft">{t('common.stepOf', { n: 3, total: 4 })}</span>
          </div>
          <Input
            label={t('newOrder.step3Title')}
            required
            autoComplete="street-address"
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
          />
          {savedAddresses.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedAddresses.map((a) => (
                <Button key={a.id} variant="secondary" size="sm" onClick={() => selectAddress(a)}>
                  {a.label}
                </Button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Input
              label={t('newOrder.step3Entrance')}
              inputMode="numeric"
              value={entrance}
              onChange={(e) => setEntrance(e.target.value)}
            />
            <Input
              label={t('newOrder.step3Floor')}
              inputMode="numeric"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
            />
            <Input
              label={t('newOrder.step3Apartment')}
              inputMode="numeric"
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
            />
          </div>
          <Input
            label={t('newOrder.step3District')}
            required
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />
          <Input
            label={t('newOrder.step3Comment')}
            value={addressComment}
            onChange={(e) => setAddressComment(e.target.value)}
          />
          <Button
            fullWidth
            size="lg"
            disabled={!addressText || !district}
            onClick={() => setStep(4)}
          >
            {t('newOrder.step3Next')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      {header(t('newOrder.step4Title'), () => setStep(3))}
      {progress}
      <div className="rounded-md bg-fill p-3.5">
        <div className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <span className="shrink-0 text-primary">
            {categoryMeta(categories.find((c) => c.id === categoryId)?.slug ?? '').icon}
          </span>
          <span>
            {categories.find((c) => c.id === categoryId)?.name} · «{description.slice(0, 40)}» ·{' '}
            {t('common.photosCount', { n: photoPaths.length })}
          </span>
        </div>
        <div className="mt-1 text-xs font-semibold text-on-fill">
          {addressText} · {t('newOrder.step3Entrance')} {entrance} · {t('newOrder.step3Floor')} {floor} · {t('newOrder.step3Apartment')} {apartment}
        </div>
      </div>
      {preview?.available === false && <Alert tone="danger">{t('newOrder.unavailable')}</Alert>}
      {preview?.available && (
        <Card as="section" padding="sm">
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
        </Card>
      )}
      <Card padding="sm" className="flex items-center justify-between">
        <span className="text-sm font-extrabold text-ink">
          {paymentsEnabled ? t('newOrder.step4PaymentMethod') : 'Бесплатный пилот · без привязки карты'}
        </span>
      </Card>
      <p className="text-xs leading-relaxed text-ink-soft">
        {paymentsEnabled
          ? t('newOrder.step4CancelNote')
          : 'Отмена до начала работ не вызывает списаний со стороны платформы. Договорённости по фактическим расходам обсуждаются напрямую с мастером.'}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="mt-auto" />
      {/* variant="urgent": это срочный вызов «Сейчас» — единственное место, где уместен оранжевый. */}
      <Button
        fullWidth
        size="lg"
        variant="urgent"
        loading={submitting}
        disabled={!preview?.available}
        onClick={submit}
      >
        {paymentsEnabled ? t('newOrder.step4Submit', { price: preview?.calloutPrice ?? '' }) : 'Найти мастера бесплатно'}
      </Button>
    </div>
  );
}
