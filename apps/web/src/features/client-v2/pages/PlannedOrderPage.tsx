import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../api';
import { getSocket } from '../../../socket';
import PwaitView from '../components/planned-order-views/PwaitView';
import PactiveView from '../components/planned-order-views/PactiveView';
import PlannedDoneView from '../components/planned-order-views/PlannedDoneView';
import PlannedClosedView from '../components/planned-order-views/PlannedClosedView';

export interface PlannedBidMaster {
  id: string;
  name: string | null;
  experienceYears: number;
  completedCount: number;
  verified: boolean;
  rating: number | null;
  reviewCount: number;
}
export interface PlannedBid {
  id: string;
  price: number;
  term: string;
  comment: string | null;
  createdAt: string;
  master: PlannedBidMaster;
}
export interface PlannedOrderMaster {
  id: string;
  name: string | null;
  phone: string;
  rating: number | null;
  reviewCount: number;
}
export interface PlannedOrderDetail {
  id: string;
  status: string;
  category: { name: string } | null;
  description: string;
  address: string;
  district: string;
  slotStart: string;
  slotEnd: string;
  budget: number | null;
  master: PlannedOrderMaster | null;
  selectedBidId: string | null;
  workPrice: number | null;
  cancelReason: string | null;
  confirmDeadline: string | null;
  bids: PlannedBid[];
  review: { rating: number; comment: string | null } | null;
}

const ACTIVE_STATUSES = ['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'];

export default function PlannedOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PlannedOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    return api(`/planned-orders/${id}`)
      .then(setOrder)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = (p: { plannedOrderId: string }) => {
      if (p.plannedOrderId === id) load();
    };
    socket.on('bid:new', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:new', onUpdate);
      socket.off('planned:status', onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="p-6 text-c2-ink-soft">Загрузка…</div>;

  if (error || !order || !id) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm font-semibold text-c2-danger">{error || 'Заявка не найдена'}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-c2-pill border-[1.5px] border-c2-primary p-3 text-sm font-extrabold text-c2-primary"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (order.status === 'PUBLISHED') return <PwaitView order={order} orderId={id} onChanged={load} />;
  if (ACTIVE_STATUSES.includes(order.status)) return <PactiveView order={order} orderId={id} />;
  if (order.status === 'DONE') return <PlannedDoneView order={order} orderId={id} onChanged={load} />;
  return <PlannedClosedView order={order} onChanged={load} />;
}
