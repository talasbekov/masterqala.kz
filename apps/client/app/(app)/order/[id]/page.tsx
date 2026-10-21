'use client';
import {DirectClientOrderView,useOrderState,useLocale} from '@masterqala/ui';
import {useAuth} from '@/lib/auth';
import {DesktopWorkspace} from '@/components/desktop-planned/DesktopWorkspace';
import {PilotOrderView} from '@/components/desktop-urgent/PilotOrderView';
import {orderSupportHref} from '@/lib/order-support';
import {UrgentMap} from '@/components/desktop-urgent/UrgentMap';
import {urgentCopy} from '@/components/desktop-urgent/copy';
import MapView from '@/components/MapView';
import { useCallback } from 'react';
import { useParams,useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { OrderDetail } from '@/lib/orderTypes';
import SearchView from '@/components/order-views/SearchView';
import NoMastersView from '@/components/order-views/NoMastersView';
import PriceView from '@/components/order-views/PriceView';
import ProgressView from '@/components/order-views/ProgressView';
import DoneView from '@/components/order-views/DoneView';
import ClosedView from '@/components/order-views/ClosedView';
import TrackView from '@/components/order-views/TrackView';

const readOrder=(id:string)=>api(`/orders/${id}`);

const TRACK_STATUSES = ['ACCEPTED', 'MASTER_ON_WAY', 'INSPECTION'];

export default function OrderPage(){const {id}=useParams<{id:string}>(),{user}=useAuth();return user&&id?<OwnedOrderPage key={user.id+':'+id} id={id}/>:null;}
function OwnedOrderPage({id}:{id:string}) {
  const { t } = useTranslation();
  const {language}=useLocale();
  const router=useRouter();
  const subscribe=useCallback((refresh:()=>void)=>{
    const socket=getSocket();const changed=(payload:{orderId:string})=>{if(payload.orderId===id)refresh();};
    socket.on('order:status',changed);socket.on('connect',refresh);
    return()=>{socket.off('order:status',changed);socket.off('connect',refresh);};
  },[id]);
  const {order,loading,error,online,fresh,busy,load,mutate}=useOrderState<OrderDetail>({id,read:readOrder,subscribe});
  if (loading) return <DesktopWorkspace><div className="planned-card" role="status">{t('common.loading')}</div></DesktopWorkspace>;

  if (!order || !id) {
    return (
      <DesktopWorkspace><div className="planned-card">
        <p role="alert">{urgentCopy[language].error}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-pill border-[1.5px] border-primary p-3 text-sm font-extrabold text-primary"
        >
          {t('common.retry')}
        </button>
      </div></DesktopWorkspace>
    );
  }

  if(order.lifecycleVersion>=2) return <DirectClientOrderView order={order} busy={busy} error={error} online={online} fresh={fresh}
    onHome={()=>router.push('/')} onBack={()=>router.push('/orders')} onHelp={()=>router.push(orderSupportHref(id))}
    onCancelPreview={()=>api(`/orders/${id}/cancellation-preview`)}
    map={<MapView mode="tracking" center={order.lat!=null&&order.lng!=null?{lat:order.lat,lng:order.lng}:{lat:51.1605,lng:71.4704}} height="100%" className="h-full rounded-none"/>}
    onAction={(action,body)=>mutate(()=>api(`/orders/${id}/${action}`,{method:'POST',body:JSON.stringify(body??{})}))}/>;

  const freePilot = order.commercialMode === 'FREE_PILOT' || order.freePilot === true;

  if(freePilot)return <DesktopWorkspace map={['CREATED','SEARCHING','ACCEPTED','MASTER_ON_WAY','INSPECTION','AWAITING_PRICE_CONFIRM','IN_PROGRESS'].includes(order.status)}><PilotOrderView order={order} language={language} categoryLabel={t(`newOrder.category_${order.category?.slug}`,{defaultValue:order.category?.name??''})} busy={busy} fresh={fresh} online={online} error={error} onRefresh={()=>void load()} onAction={(action,body)=>mutate(()=>api(`/orders/${id}/${action}`,{method:'POST',body:JSON.stringify(body??{})}))} map={<UrgentMap key={order.id+':'+(order.master?.id??'none')+':'+order.status} id={order.id} lat={order.lat} lng={order.lng} language={language} searching={['CREATED','SEARCHING'].includes(order.status)}/>} /></DesktopWorkspace>;

  if (order.status === 'SEARCHING') return <SearchView order={order} onChanged={load} />;
  if (order.status === 'NO_MASTERS') return <NoMastersView orderId={id} freePilot={freePilot} onChanged={load} />;
  if (TRACK_STATUSES.includes(order.status)) return <TrackView order={order} orderId={id} />;
  if (order.status === 'AWAITING_PRICE_CONFIRM') return <PriceView order={order} orderId={id} onChanged={load} />;
  if (order.status === 'IN_PROGRESS') return <ProgressView order={order} />;
  if (order.status === 'DONE') return <DoneView order={order} orderId={id} onChanged={load} />;
  return <ClosedView order={order} onChanged={load} />;
}
