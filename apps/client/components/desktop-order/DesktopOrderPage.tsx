'use client';
import {Suspense,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {useLocale} from '@masterqala/ui';
import {useTranslation} from 'react-i18next';
import {useAuth} from '@/lib/auth';
import {api} from '@/lib/api';
import {useCommercialMode} from '@/lib/commercial-mode';
import {emptyNewOrderDraft,currentOrderSubmission,type NewOrderDraft} from '@/lib/new-order-draft';
import {readGuestDraft,saveGuestDraft,startGuestContinuation} from '@/lib/guest-draft';
import {useNewOrderDraft,useCurrentOrderCreation} from '@/components/useNewOrderDraft';
import {NewOrderCreationStatus} from '@/components/NewOrderCreationStatus';
import MapView from '@/components/MapView';
import {desktopCopy,savedAddressCopy} from './copy';
import {SavedAddressPicker} from './SavedAddressPicker';
import {savedAddressPatch} from './saved-address';
import {useCategoryLink} from './useCategoryLink';
import './saved-address.css';

type SetField=<K extends keyof NewOrderDraft>(key:K,value:NewOrderDraft[K])=>void;
type Category={id:string;slug:string;name:string};
type Preview={available:boolean};
function useCopy(){const {language}=useLocale();return {...desktopCopy[language],...savedAddressCopy[language]};}
export default function DesktopOrderPage(){
 const {user}=useAuth();
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
 if(!mounted)return <div className="desktop-order-loading">MasterQala</div>;
 return <Suspense fallback={<div className="desktop-order-loading">MasterQala</div>}>{user?<OwnedOrder key={user.id} ownerId={user.id}/>:<GuestOrder/>}</Suspense>;
}
function GuestOrder(){
 const [draft,setDraft]=useState(()=>readGuestDraft()??emptyNewOrderDraft());
 const [error,setError]=useState('');const router=useRouter(),c=useCopy();
 const latest=useRef(draft);latest.current=draft;
 const set:SetField=(key,value)=>{const previous=latest.current;const next={...previous,[key]:value,locationChosen:previous.locationChosen||key==='geo'||key==='addressText'};latest.current=next;setDraft(next);setError(saveGuestDraft(next)?'':c.storage);};
 function login(target='/'){if(!startGuestContinuation(latest.current)){setError(c.storage);return;}router.push('/login?returnTo='+encodeURIComponent(target));}
 return <OrderSurface draft={draft} set={set} onSubmit={()=>login()} onLogin={login} error={error}/>;
}
function OwnedOrder({ownerId}:{ownerId:string}){
 const {draft,ready,set,patch,beginCreate,finishCreate,pending,completedOrderId}=useNewOrderDraft(ownerId);
 const router=useRouter(),c=useCopy();
 const creation=useCurrentOrderCreation({beginCreate,finishCreate,pending,api,invalidMessage:c.required,onConfirmed:id=>router.push(`/order/${encodeURIComponent(id)}`)});
 if(!ready)return <div className="desktop-order-loading">{c.loading}</div>;
 if(pending||completedOrderId)return <NewOrderCreationStatus pending={!!pending} persistent={pending?.persistent??true} submitting={creation.busy} completedOrderId={completedOrderId} error={creation.error} onRecover={creation.canRecover?creation.recover:undefined} online={creation.online} recovering={creation.recovering}/>;
 return <OrderSurface draft={draft} set={set} patch={patch} ownerId={ownerId} onSubmit={creation.submit} onLogin={()=>{}} error={creation.error} busy={creation.busy} online={creation.online} signedIn/>;
}
function OrderSurface({draft,set,patch,ownerId,onSubmit,onLogin,error,busy=false,online=true,signedIn=false}:{draft:NewOrderDraft;set:SetField;patch?:(fields:Partial<NewOrderDraft>)=>void;ownerId?:string;onSubmit:()=>void;onLogin:(target?:string)=>void;error:string;busy?:boolean;online?:boolean;signedIn?:boolean}){
 const {language,setLanguage,t:copy}=useLocale(),{t}=useTranslation(),c=useCopy(),{logout,guestTransfer}=useAuth();
 const {commercialMode}=useCommercialMode();
 const [categories,setCategories]=useState<Category[]>([]),[categoryError,setCategoryError]=useState('');
 const [categoriesLoaded,setCategoriesLoaded]=useState(false),[addressApplied,setAddressApplied]=useState(false);
 const search=useSearchParams().toString(),router=useRouter();
 useCategoryLink(search,categoriesLoaded?categories:null,id=>set('categoryId',id),href=>router.replace(href+window.location.hash,{scroll:false}));
 const [preview,setPreview]=useState<{key:string;value:Preview}|null>(null),[previewError,setPreviewError]=useState('');
 const [retry,setRetry]=useState(0),[geoError,setGeoError]=useState('');
 const locationRevision=useRef(0),active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const change:SetField=(key,value)=>{if(key==='geo'||key==='addressText')locationRevision.current++;set(key,value);};
 useEffect(()=>{const controller=new AbortController();setCategoryError('');api('/categories',{signal:controller.signal}).then(value=>{if(!controller.signal.aborted){setCategories(value);setCategoriesLoaded(true);}}).catch(e=>{if(!controller.signal.aborted)setCategoryError(e.message);});return()=>controller.abort();},[retry]);
 const previewKey=JSON.stringify([draft.categoryId,draft.geo.lat,draft.geo.lng,!!draft.locationNeedsConfirmation]);
 useEffect(()=>{
  setPreview(null);setPreviewError('');if(!signedIn||!draft.categoryId||draft.locationNeedsConfirmation)return;
  const controller=new AbortController();
  const timer=window.setTimeout(()=>{api('/orders/preview',{method:'POST',signal:controller.signal,body:JSON.stringify({categoryId:draft.categoryId,lat:draft.geo.lat,lng:draft.geo.lng})}).then(value=>{if(!controller.signal.aborted)setPreview({key:previewKey,value});}).catch(e=>{if(!controller.signal.aborted)setPreviewError(e.message);});},250);
  return()=>{window.clearTimeout(timer);controller.abort();};
 },[signedIn,previewKey,retry,draft.categoryId,draft.geo.lat,draft.geo.lng,draft.locationNeedsConfirmation]);
 const currentPreview=preview?.key===previewKey?preview.value:null;
 const masterUrl=process.env.NEXT_PUBLIC_MASTER_APP_URL??(process.env.NODE_ENV==='development'?'http://localhost:4300':null);
 const supported=commercialMode==='FREE_PILOT'||commercialMode==='DIRECT_PAYMENT';
 const valid=!!currentOrderSubmission(draft);
 function locate(){const revision=++locationRevision.current;setGeoError('');if(!navigator.geolocation){setGeoError(c.geoError);return;}navigator.geolocation.getCurrentPosition(position=>{if(active.current&&revision===locationRevision.current)change('geo',{lat:position.coords.latitude,lng:position.coords.longitude});},()=>{if(active.current&&revision===locationRevision.current)setGeoError(c.geoError);});}
 function input(key:'addressText'|'district'|'entrance'|'floor'|'apartment'|'addressComment',label:string,maxLength:number){return <label className="desktop-field" key={key}><span>{label}</span><input value={draft[key]} maxLength={maxLength} onChange={e=>change(key,e.target.value)} required={key==='addressText'||key==='district'}/></label>;}
 return <div className="desktop-order">
  <div className="desktop-map" role="region" aria-label={c.map}><MapView mode="pin" center={draft.geo} onCenterChange={geo=>change('geo',geo)} height="100%" className="desktop-map-canvas"/></div>
  <header className="desktop-header"><Link href="/" className="desktop-brand" aria-label="MasterQala">Master<span>Qala</span><i aria-hidden="true">.</i></Link><nav aria-label={c.orders}><Link href="/orders" onClick={event=>{if(!signedIn){event.preventDefault();onLogin('/orders');}}}>{c.orders}</Link><Link href="/support" onClick={event=>{if(!signedIn){event.preventDefault();onLogin('/support');}}}>{c.help}</Link></nav><div className="desktop-header-actions"><div className="desktop-locales" aria-label="Language">{(['ru','kk','en'] as const).map(locale=><button type="button" key={locale} aria-pressed={language===locale} onClick={()=>setLanguage(locale)}>{locale==='kk'?'KZ':locale.toUpperCase()}</button>)}</div>{signedIn?<><Link className="desktop-login" href="/profile">{c.profile}</Link><button type="button" className="desktop-signout" onClick={logout}>{c.logout}</button></>:<button type="button" className="desktop-login" onClick={()=>onLogin()}>{c.login}</button>}</div></header>
  <form className="desktop-order-panel" onSubmit={e=>{e.preventDefault();if(!busy&&online&&supported&&valid&&(!signedIn||currentPreview?.available))onSubmit();}}>
   <section className="desktop-card desktop-task"><h1>{c.title}</h1><p>{c.intro}</p>{signedIn&&ownerId&&patch&&<SavedAddressPicker ownerId={ownerId} api={api} copy={c} disabled={busy} onApply={address=>{locationRevision.current++;patch(savedAddressPatch(address));setAddressApplied(true);}}/>}{(addressApplied||draft.locationNeedsConfirmation)&&<p role="status" className="desktop-address-notice">{draft.locationNeedsConfirmation?c.savedAddressNoPin:c.savedAddressCheck}</p>}{draft.locationNeedsConfirmation&&<button type="button" className="desktop-location-confirm" onClick={()=>change('geo',draft.geo)}>{c.confirmPin}</button>}{input('addressText',c.address,500)}{input('district',c.district,200)}<label className="desktop-field"><span id="desktop-description-label">{c.description}</span><textarea aria-labelledby="desktop-description-label" value={draft.description} maxLength={2000} required placeholder={c.placeholder} onChange={e=>change('description',e.target.value)}/></label>{draft.photoPaths.length>0&&<p role="status">{t('common.photosCount',{n:draft.photoPaths.length})} — <Link href="/order/new">{c.stepForm}</Link></p>}<details><summary>{c.details}</summary><div className="desktop-address-details">{input('entrance',c.entrance,50)}{input('floor',c.floor,50)}{input('apartment',c.apartment,50)}</div>{input('addressComment',c.comment,500)}</details></section>
   <section className="desktop-card"><h2>{c.category}</h2><div className="desktop-categories">{categories.map(category=><button type="button" key={category.id} aria-pressed={draft.categoryId===category.id} onClick={()=>change('categoryId',category.id)}><span className="desktop-category-symbol" aria-hidden="true"><img src={category.slug==='electrics'?'/desktop/bolt.svg':'/desktop/wrench.svg'} width={24} height={24} alt=""/></span>{t(`newOrder.category_${category.slug}`,{defaultValue:category.name})}</button>)}</div>{categoryError?<div role="alert">{categoryError}<button type="button" onClick={()=>setRetry(n=>n+1)}>{c.retry}</button></div>:!categories.length?<p>{c.loading}</p>:null}</section>
   <section className="desktop-card desktop-mode"><span aria-current="true">{c.now}</span><Link href="/planned/new" onClick={event=>{if(!signedIn){event.preventDefault();onLogin('/planned/new');}}}>{c.planned}</Link></section>
   <section className="desktop-card desktop-confirm"><h2>{commercialMode==='FREE_PILOT'?c.pilot:t('newOrder.step4PaymentMethod')}</h2><p>{commercialMode==='FREE_PILOT'?c.pilotNote:copy('directCreateNote')}</p>{!supported&&<p role="alert">{c.notReady}</p>}{!online&&<p role="status">{c.offline}</p>}{signedIn&&draft.categoryId&&!draft.locationNeedsConfirmation&&!currentPreview&&!previewError&&<p role="status">{c.checking}</p>}{currentPreview?.available===false&&<p role="status">{c.unavailable}</p>}{previewError&&<div role="alert">{previewError}<button type="button" onClick={()=>setRetry(n=>n+1)}>{c.retry}</button></div>}{guestTransfer==='conflict'&&<p role="status">{c.conflict}</p>}{guestTransfer==='unavailable'&&<p role="alert">{c.storageLogin}</p>}{error&&<p role="alert">{error}</p>}<button type="submit" className="desktop-submit" disabled={!valid||busy||!online||!supported||(signedIn&&!currentPreview?.available)}>{busy?c.loading:signedIn?c.create:c.continue}</button><Link className="desktop-step-link" href="/order/new" onClick={event=>{if(!signedIn){event.preventDefault();onLogin('/order/new');}}}>{c.stepForm}</Link></section>
  </form>
  {masterUrl&&<aside className="desktop-master-card"><div><strong>{c.master}</strong><p>{c.masterNote}</p></div><a href={masterUrl}>{c.masterAction} <span aria-hidden="true">↗</span></a></aside>}
  <div className="desktop-map-tools"><p>{c.mapHint}</p><button type="button" onClick={locate}>{c.location}</button>{geoError&&<p role="alert">{geoError}</p>}</div>
  <a className="desktop-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
 </div>;
}
