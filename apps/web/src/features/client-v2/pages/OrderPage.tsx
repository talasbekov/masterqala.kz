import {DirectClientOrderView,useOrderState,type DirectOrder} from '@masterqala/ui';
import { useCallback } from 'react';
import { useParams,useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { getSocket } from '../../../socket';
import SearchView from '../components/order-views/SearchView';
import NoMastersView from '../components/order-views/NoMastersView';
import PriceView from '../components/order-views/PriceView';
import ProgressView from '../components/order-views/ProgressView';
import DoneView from '../components/order-views/DoneView';
import ClosedView from '../components/order-views/ClosedView';
import TrackView from '../components/order-views/TrackView';

export interface OrderMaster {
  id: string;
  name: string | null;
  phone: string;
  rating: number | null;
  reviewCount: number;
}
export interface OrderDetail extends DirectOrder {
  id: string;
  status: string;
  commercialMode: 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE' | 'DIRECT_PAYMENT';
  freePilot?: boolean;
  wave: number;
  category: { name: string } | null;
  master: OrderMaster | null;
  address: string;
  description: string;
  calloutPrice: number;
  serviceFee: number;
  workPrice: number | null;
  workComment: string | null;
  cancelReason: string | null;
  createdAt: string;
  priceProposedAt: string | null;
  priceDeadline: string | null;
  review: { rating: number; comment: string | null } | null;
}

const readOrder=(id:string)=>api(`/orders/${id}`);

const TRACK_STATUSES = ['ACCEPTED', 'MASTER_ON_WAY', 'INSPECTION'];

export default function OrderPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate=useNavigate();
  const subscribe=useCallback((refresh:()=>void)=>{
    const socket=getSocket();const changed=(payload:{orderId:string})=>{if(payload.orderId===id)refresh();};
    socket.on('order:status',changed);socket.on('connect',refresh);
    return()=>{socket.off('order:status',changed);socket.off('connect',refresh);};
  },[id]);
  const {order,loading,error,online,fresh,busy,load,mutate}=useOrderState<OrderDetail>({id:id??'',read:readOrder,subscribe});
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
    onBack={()=>navigate('/orders')} onHelp={()=>navigate('/support')}
    onCancelPreview={()=>api(`/orders/${id}/cancellation-preview`)}
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
