import { useEffect, useRef, useState } from 'react';
import {useLocale,useNewOrderDraft,useCurrentOrderCreation,type NewOrderDraft} from '@masterqala/ui';
import {useAuth} from '../../../auth';
import {NewOrderCreationStatus} from '../components/NewOrderCreationStatus';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '../../../api';
import { useCommercialMode } from '../../../commercial-mode';
import { categoryMeta } from '../categoryMeta';
import MapView from '../components/MapView';

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

export default function NewOrderPage() {
  const {user}=useAuth();
  return user?<OwnedNewOrderPage key={user.id} ownerId={user.id}/>:null;
}

function OwnedNewOrderPage({ownerId}:{ownerId:string}) {
  const { t } = useTranslation();
  const { paymentsEnabled,commercialMode } = useCommercialMode();
  const direct=commercialMode==='DIRECT_PAYMENT';
  const {t:copy}=useLocale();
  const navigate = useNavigate();
  const lifetime=useRef({ownerId,active:true});
  if(lifetime.current.ownerId!==ownerId)lifetime.current={ownerId,active:true};
  useEffect(()=>{const current=lifetime.current;current.active=true;return()=>{current.active=false}},[ownerId]);
  const draftState=useNewOrderDraft(ownerId);
  const {step,categoryId,description,photoPaths,geo,addressText,district,entrance,floor,apartment,addressComment}=draftState.draft;
  const setter=<K extends keyof NewOrderDraft>(key:K)=>(value:NewOrderDraft[K]|((previous:NewOrderDraft[K])=>NewOrderDraft[K]))=>draftState.set(key,value);
  const setStep=setter('step'),setCategoryId=setter('categoryId'),setDescription=setter('description'),setPhotoPaths=setter('photoPaths'),setGeo=setter('geo'),setAddressText=setter('addressText'),setDistrict=setter('district'),setEntrance=setter('entrance'),setFloor=setter('floor'),setApartment=setter('apartment'),setAddressComment=setter('addressComment');
  const [categories,setCategories]=useState<Category[]>([]);
  const [savedAddresses,setSavedAddresses]=useState<Address[]>([]);
  const [uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [error,setError]=useState('');
  const creation=useCurrentOrderCreation({beginCreate:draftState.beginCreate,finishCreate:draftState.finishCreate,pending:draftState.pending,api,onConfirmed:(id)=>navigate(`/order/${encodeURIComponent(id)}`),invalidMessage:copy('createSubmissionInvalid')});
  const submitting=creation.busy;
  const submit=()=>{if(preview&&(direct||preview.available))return creation.submit();};

  useEffect(() => {
    if(!ownerId)return;
    let active=true;
    setSavedAddresses([]);setUploading(false);setError('');
    api('/categories').then(value=>{if(active)setCategories(value)}).catch(e=>{if(active)setError((e as Error).message)});
    api('/addresses').then(value=>{if(active)setSavedAddresses(value)}).catch(()=>{});
    navigator.geolocation?.getCurrentPosition(
      pos=>{if(active)draftState.applyInitialLocation({lat:pos.coords.latitude,lng:pos.coords.longitude})},
      ()=>{if(active)setError(t('newOrder.geoError'))},
    );
    return()=>{active=false};
  }, [ownerId,draftState.applyInitialLocation]);

  useEffect(() => {
    let active=true;setPreview(null);
    if(!draftState.ready||draftState.pending||step!==4||!categoryId)return;
    api('/orders/preview',{method:'POST',body:JSON.stringify({categoryId,lat:geo.lat,lng:geo.lng})})
      .then(value=>{if(active)setPreview(value)}).catch(e=>{if(active)setError((e as Error).message)});
    return()=>{active=false};
  },[ownerId,draftState.ready,draftState.pending,step,categoryId,geo.lat,geo.lng]);

  function selectAddress(a: Address) {
    setAddressText(a.address);
    setEntrance(a.entrance ?? '');
    setFloor(a.floor ?? '');
    setApartment(a.apartment ?? '');
    if (a.lat != null && a.lng != null) setGeo({ lat: a.lat, lng: a.lng });
  }

  async function addPhoto(file: File) {
    const current=lifetime.current;
    if(!current.active||uploading||draftState.pending)return;
    setUploading(true);
    try {
      const res = await apiUpload('/uploads', (() => {
        const fd = new FormData();
        fd.append('file', file);
        return fd;
      })());
      if(lifetime.current!==current||!current.active)return;
      setPhotoPaths((prev) => [...prev, res.path].slice(0, 5));
    } catch (e) {
      if(lifetime.current===current&&current.active)setError((e as Error).message);
    } finally {
      if(lifetime.current===current&&current.active)setUploading(false);
    }
  }

  if(!draftState.ready||!ownerId)return null;
  if(draftState.pending||draftState.completedOrderId)return <NewOrderCreationStatus pending={!!draftState.pending} persistent={draftState.pending?.persistent??true} submitting={creation.busy} completedOrderId={draftState.completedOrderId} error={creation.error} onRecover={creation.canRecover?creation.recover:undefined} online={creation.online} recovering={creation.recovering}/>;

  const progress = (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-border'}`} />
      ))}
    </div>
  );

  const header = (title: string, back: () => void) => (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={back} className="text-xl text-primary">
        ←
      </button>
      <span className="flex-1 text-lg font-extrabold text-ink">{title}</span>
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
          onClick={() => navigate('/support')}
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
        {(error||creation.error) && <p className="text-sm font-semibold text-danger">{error||creation.error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(3)}
          className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white"
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
            onClick={() => {const apply=draftState.requestLocation();navigator.geolocation?.getCurrentPosition(pos=>apply({lat:pos.coords.latitude,lng:pos.coords.longitude}));}}
            className="absolute bottom-3 right-3 rounded-pill bg-white px-3 py-2 text-xs font-extrabold text-ink shadow-card"
          >
            ◎ {t('newOrder.step3MyLocation')}
          </button>
        </div>
        <div className="flex flex-col gap-2.5 px-5">
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-ink">{t('newOrder.step3Title')}</span>
            <span className="text-xs font-bold text-ink-soft">{t('common.stepOf', { n: 3, total: 4 })}</span>
          </div>
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
            onClick={() => setStep(4)}
            disabled={!addressText || !district}
            className="rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
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
      {direct&&preview&&<div className="rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-ink-soft">{copy('directCreateNote')}</div>}
      {!direct&&preview?.available && (
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
          {direct?copy('directPayment'):paymentsEnabled ? t('newOrder.step4PaymentMethod') : 'Бесплатный пилот · без привязки карты'}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">
        {direct?copy('directCancelNote'):paymentsEnabled
          ? t('newOrder.step4CancelNote')
          : 'Отмена до начала работ не вызывает списаний со стороны платформы. Договорённости по фактическим расходам обсуждаются напрямую с мастером.'}
      </p>
      {(error||creation.error) && <p className="text-sm font-semibold text-danger">{error||creation.error}</p>}
      <div className="mt-auto" />
      <button
        type="button"
        onClick={submit}
        disabled={submitting || !creation.online || !preview || (!direct&&!preview.available)}
        className="rounded-pill bg-primary p-4 text-[15.5px] font-extrabold text-white disabled:opacity-40"
      >
        {direct?copy('findMaster'):paymentsEnabled ? t('newOrder.step4Submit', { price: preview?.calloutPrice ?? '' }) : 'Найти мастера бесплатно'}
      </button>
    </div>
  );
}
