'use client';
import { useEffect, useRef, useState } from 'react';
import {TextField,useLocale} from '@masterqala/ui';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api, apiUpload } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';
import MapView from '@/components/MapView';
import {useAuth} from '@/lib/auth';
import {useNewOrderDraft,useCurrentOrderCreation} from '@/components/useNewOrderDraft';
import {NewOrderLayout} from '@/components/NewOrderLayout';
import Link from 'next/link';
import {NewOrderCreationStatus} from '@/components/NewOrderCreationStatus';
import type {NewOrderDraft} from '@/lib/new-order-draft';
import {SavedAddressPicker} from '@/components/desktop-order/SavedAddressPicker';
import {savedAddressPatch} from '@/components/desktop-order/saved-address';
import {savedAddressCopy,desktopCopy} from '@/components/desktop-order/copy';

interface Category {
  id: string;
  slug: string;
  name: string;
}
interface Preview {
  available: boolean;
  calloutPrice?: number;
  serviceFee?: number;
}

export default function NewOrderPage() {
  const {user}=useAuth();
  return user?<NewOrderForm key={user.id} ownerId={user.id}/>:null;
}

function NewOrderForm({ownerId}:{ownerId:string}) {
  const { t } = useTranslation();
  const { paymentsEnabled,commercialMode } = useCommercialMode();
  const direct=commercialMode==='DIRECT_PAYMENT';
  const {t:copy,language}=useLocale();
  const addressCopy={...savedAddressCopy[language],...desktopCopy[language]};
  const router = useRouter();
  const {draft,ready,set,patch,applyInitialLocation,requestLocation,beginCreate,finishCreate,pending,completedOrderId}=useNewOrderDraft(ownerId);
  const {step,categoryId,description,photoPaths,geo,addressText,district,entrance,floor,apartment,addressComment}=draft;
  function field<K extends keyof NewOrderDraft>(key:K) {
    return (value:NewOrderDraft[K]|((previous:NewOrderDraft[K])=>NewOrderDraft[K]))=>set(key,value);
  }
  const setStep=field('step'),setCategoryId=field('categoryId'),setDescription=field('description'),setPhotoPaths=field('photoPaths');
  const setGeo=field('geo'),setAddressText=field('addressText'),setDistrict=field('district'),setEntrance=field('entrance');
  const setFloor=field('floor'),setApartment=field('apartment'),setAddressComment=field('addressComment');
  const photoInput=useRef<HTMLInputElement>(null);
  const translation=useRef(t);translation.current=t;

  const [categories, setCategories] = useState<Category[]>([]);

  const [uploading, setUploading] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const creation=useCurrentOrderCreation({beginCreate,finishCreate,pending,api,invalidMessage:copy('createSubmissionInvalid'),onConfirmed:id=>router.push(`/order/${encodeURIComponent(id)}`)});
  const submitting=creation.busy;

  useEffect(() => {
    if (!ready||pending||completedOrderId) return;
    let cancelled=false;
    api('/categories').then(value=>{if(!cancelled)setCategories(value);}).catch((e)=>{if(!cancelled)setError((e as Error).message);});
    navigator.geolocation?.getCurrentPosition(
      (pos) => {if(!cancelled)applyInitialLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });},
      () => {if(!cancelled)setError(translation.current('newOrder.geoError'));},
    );
    return()=>{cancelled=true;};
  }, [ready,applyInitialLocation,pending,completedOrderId]);

  useEffect(() => {
    if (!ready || pending || completedOrderId || step !== 4 || !categoryId) return;
    let cancelled=false;
    setPreview(null);
    api('/orders/preview', { method: 'POST', body: JSON.stringify({ categoryId, lat: geo.lat, lng: geo.lng }) })
      .then(value=>{if(!cancelled)setPreview(value);})
      .catch((e)=>{if(!cancelled)setError((e as Error).message);});
    return()=>{cancelled=true;};
  }, [ready,step,categoryId,geo,pending,completedOrderId]);

  function categoryName(category?:Category){return category?t(`newOrder.category_${category.slug}`,{defaultValue:category.name}):'';}

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

  if(!ready)return <div className="p-6 text-ink-soft">{t('common.loading')}</div>;

  if(pending||completedOrderId)return <NewOrderCreationStatus pending={!!pending} persistent={pending?.persistent??true} submitting={submitting} completedOrderId={completedOrderId} error={creation.error||error} onRecover={creation.canRecover?creation.recover:undefined} online={creation.online} recovering={creation.recovering}/>;

  const progress = (
    <div role="progressbar" aria-label={t('common.stepOf', { n: step, total: 4 })} aria-valuemin={1} aria-valuemax={4} aria-valuenow={step} className="flex gap-1.5">
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
    <div>
      <button type="button" onClick={goBack} aria-label={copy('back')} className="mq-new-order-icon-action text-xl">←</button>
      <h1 id="new-order-heading">{stepTitles[step]}</h1>
      <Link href="/support" aria-label={copy('help')} className="mq-new-order-icon-action">?</Link>
    </div>
  );

  let stepContent: React.ReactNode;

  if (step === 1) {
    stepContent = (
      <>
        <div className="text-xl font-extrabold text-ink">{t('newOrder.step1Question')}</div>
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((c) => {
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                aria-pressed={active}
                className={`mq-new-order-category rounded-md border-2 p-3.5 text-left ${
                  active ? 'border-primary bg-fill-soft' : 'border-border bg-surface'
                }`}
              >
                {(c.slug==='plumbing'||c.slug==='electrics')&&<img className="mb-1.5" src={c.slug==='electrics'?'/desktop/bolt.svg':'/desktop/wrench.svg'} alt="" width={24} height={24}/>}
                <div className="text-sm font-extrabold text-ink">{categoryName(c)}</div>
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
          className="mq-new-order-primary rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          {t('common.next')}
        </button>
      </>
    );
  } else if (step === 2) {
    stepContent = (
      <>
        <h2 className="mq-new-order-task-title">{t('newOrder.step2Title')}</h2>
        <div className="mq-new-order-description">
          <label htmlFor="new-order-description">{t('newOrder.step2Title')}</label>
          <textarea id="new-order-description" value={description} onChange={(e)=>setDescription(e.target.value)} maxLength={2000} placeholder={t('newOrder.step2Placeholder')}/>
        </div>
        <div className="text-sm font-extrabold text-ink">
          {t('newOrder.step2PhotosLabel')} <span className="text-xs font-semibold text-ink-soft">{t('newOrder.step2PhotosHint')}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {photoPaths.map((p) => (
            <div key={p} className="h-18 w-18 rounded-md bg-fill" />
          ))}
          {photoPaths.length < 5 && (
            <div>
              <button type="button" aria-label={t('newOrder.step2PhotosLabel')} disabled={uploading} onClick={()=>photoInput.current?.click()} className="flex h-18 w-18 items-center justify-center rounded-md border-[1.5px] border-dashed border-primary text-2xl text-primary disabled:opacity-40"><span aria-hidden="true">＋</span></button>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-label={t('newOrder.step2PhotosLabel')} disabled={uploading} onChange={(e)=>e.target.files?.[0]&&addPhoto(e.target.files[0])}/>
            </div>
          )}
        </div>
        {(creation.error||error) && <p role="alert" className="text-sm font-semibold text-danger">{creation.error||error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(3)}
          className="mq-new-order-primary rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white"
        >
          {t('newOrder.step2Next')}
        </button>
      </>
    );
  } else if (step === 3) {
    stepContent = (
      <>
        <TextField label={t('newOrder.step3Title')} variant="responsive" fullWidth value={addressText} maxLength={500} onChange={(e)=>setAddressText(e.target.value)}/>
        <SavedAddressPicker ownerId={ownerId} api={api} copy={addressCopy} onApply={address=>patch(savedAddressPatch(address))}/>
        {draft.locationNeedsConfirmation&&<div role="status"><p>{addressCopy.savedAddressNoPin}</p><button type="button" className="mq-new-order-primary" onClick={()=>setGeo(geo)}>{addressCopy.confirmPin}</button></div>}
        <div className="mq-new-order-address-details">
          <TextField label={t('newOrder.step3Entrance')} variant="responsive" fullWidth value={entrance} maxLength={50} onChange={(e)=>setEntrance(e.target.value)}/>
          <TextField label={t('newOrder.step3Floor')} variant="responsive" fullWidth value={floor} maxLength={50} onChange={(e)=>setFloor(e.target.value)}/>
          <TextField label={t('newOrder.step3Apartment')} variant="responsive" fullWidth value={apartment} maxLength={50} onChange={(e)=>setApartment(e.target.value)}/>
        </div>
        <TextField label={t('newOrder.step3District')} variant="responsive" fullWidth value={district} maxLength={200} onChange={(e)=>setDistrict(e.target.value)}/>
        <TextField label={t('newOrder.step3Comment')} variant="responsive" fullWidth value={addressComment} maxLength={500} onChange={(e)=>setAddressComment(e.target.value)}/>
        <button
          type="button"
          onClick={() => {
            const apply=requestLocation();
            navigator.geolocation?.getCurrentPosition((pos)=>apply({lat:pos.coords.latitude,lng:pos.coords.longitude}));
          }}
          className="rounded-pill border-[1.5px] border-border p-2.5 text-xs font-extrabold text-ink-soft"
        >
          ◎ {t('newOrder.step3MyLocation')}
        </button>
        <div className="mt-auto" />
        <button
          type="button"
          onClick={() => setStep(4)}
          disabled={!addressText || !district || draft.locationNeedsConfirmation}
          className="mq-new-order-primary rounded-pill bg-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
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
            {categoryName(categories.find((c) => c.id === categoryId))} · «{description.slice(0, 40)}» ·{' '}
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
                : t('newOrder.freePilotNote')}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
          <span className="text-sm font-extrabold text-ink">
            {direct?copy('directPayment'):paymentsEnabled ? t('newOrder.step4PaymentMethod') : t('newOrder.freePilotPaymentLabel')}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-ink-soft">
          {paymentsEnabled
            ? t('newOrder.step4CancelNote')
            : t('newOrder.freePilotCancelNote')}
        </p>
        {(creation.error||error) && <p role="alert" className="text-sm font-semibold text-danger">{creation.error||error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={creation.submit}
          disabled={submitting || !creation.online || !preview?.available}
          className="mq-new-order-primary rounded-pill bg-primary p-4 text-[15.5px] font-extrabold text-white disabled:opacity-40"
        >
          {direct?copy('findMaster'):paymentsEnabled ? t('newOrder.step4Submit', { price: preview?.calloutPrice ?? '' }) : t('newOrder.freePilotSubmit')}
        </button>
      </>
    );
  }

  return <NewOrderLayout step={step} header={header} progress={progress} mapLabel={t('newOrder.step3Title')}
    map={<MapView mode="pin" center={geo} onCenterChange={step===3?setGeo:undefined} height="100%" className="h-full"/>}>
    {stepContent}
  </NewOrderLayout>;
}
