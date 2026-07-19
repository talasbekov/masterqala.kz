import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PactiveView({ order }: { order: PlannedOrderDetail; orderId: string }) {
  return <div className="p-6 text-c2-ink-soft">Загрузка… ({order.status})</div>;
}
