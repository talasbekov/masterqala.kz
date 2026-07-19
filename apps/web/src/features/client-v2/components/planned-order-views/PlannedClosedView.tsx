import type { PlannedOrderDetail } from '../../pages/PlannedOrderPage';

export default function PlannedClosedView({ order }: { order: PlannedOrderDetail; onChanged: () => void }) {
  return <div className="p-6 text-c2-ink-soft">Загрузка… ({order.status})</div>;
}
