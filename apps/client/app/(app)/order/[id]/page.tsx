'use client';
import {DirectClientOrderView,useOrderState} from '@masterqala/ui';
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

export default function OrderPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router=useRouter();
  const subscribe=useCallback((refresh:()=>void)=>{
    const socket=getSocket();const changed=(payload:{orderId:string})=>{if(payload.orderId===id)refresh();};
    socket.on('order:status',changed);socket.on('connect',refresh);
    return()=>{socket.off('order:status',changed);socket.off('connect',refresh);};
  },[id]);
  const {order,loading,error,online,fresh,busy,load,mutate}=useOrderState<OrderDetail>({id,read:readOrder,subscribe});
  if (loading) return <div className="p-6 text-ink-soft">{t('common.loading')}</div>;

  if (!order || !id) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm font-semibold text-danger">{error || t('orderDetail.notFound')}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-pill border-[1.5px] border-primary p-3 text-sm font-extrabold text-primary"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if(order.lifecycleVersion>=2) return <DirectClientOrderView order={order} busy={busy} error={error} online={online} fresh={fresh}
    onHome={()=>router.push('/')} onBack={()=>router.push('/orders')} onHelp={()=>router.push('/support')}
    onCancelPreview={()=>api(`/orders/${id}/cancellation-preview`)}
    map={<MapView mode="tracking" center={order.lat!=null&&order.lng!=null?{lat:order.lat,lng:order.lng}:{lat:51.1605,lng:71.4704}} height="100%" className="h-full rounded-none"/>}
    onAction={(action,body)=>mutate(()=>api(`/orders/${id}/${action}`,{method:'POST',body:JSON.stringify(body??{})}))}/>;

  const freePilot = order.commercialMode === 'FREE_PILOT' || order.freePilot === true;

  if (order.status === 'SEARCHING') return <SearchView order={order} onChanged={load} />;
  if (order.status === 'NO_MASTERS') return <NoMastersView orderId={id} freePilot={freePilot} onChanged={load} />;
  if (TRACK_STATUSES.includes(order.status)) return <TrackView order={order} orderId={id} />;
  if (order.status === 'AWAITING_PRICE_CONFIRM') return <PriceView order={order} orderId={id} onChanged={load} />;
  if (order.status === 'IN_PROGRESS') return <ProgressView order={order} />;
  if (order.status === 'DONE') return <DoneView order={order} orderId={id} onChanged={load} />;
  return <ClosedView order={order} onChanged={load} />;
}
