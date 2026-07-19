import type { OrderDetail } from '../../pages/OrderPage';

export default function TrackView({ order }: { order: OrderDetail; orderId: string }) {
  return <div className="p-6 text-c2-ink-soft">Загрузка… ({order.status})</div>;
}
