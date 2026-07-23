import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { STEPPER_STEPS } from '../../../../orderStatus';
import type { OrderDetail } from '../../pages/OrderPage';

export default function ProgressView({ order }: { order: OrderDetail }) {
  const { t } = useTranslation();
  const paymentsEnabled = order.commercialMode !== 'FREE_PILOT' && order.freePilot !== true;
  const currentIdx = STEPPER_STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="flex flex-col gap-3.5 px-5 pb-3.5 pt-1.5">
      <div className="text-lg font-extrabold text-c2-ink">{t('orderDetail.orderNumber', { id: order.id.slice(0, 8) })}</div>
      <div className="flex flex-col">
        {STEPPER_STEPS.map((s, i) => {
          const done = i < currentIdx || (i === currentIdx && order.status !== s.status);
          const active = s.status === order.status;
          return (
            <div key={s.status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-5.5 w-5.5 items-center justify-center rounded-full border-2 text-[11px] text-white ${
                    done || active ? 'border-c2-primary bg-c2-primary' : 'border-c2-border bg-c2-surface'
                  }`}
                >
                  {done ? '✓' : ''}
                </div>
                {i < STEPPER_STEPS.length - 1 && <div className="min-h-4.5 w-0.5 flex-1 bg-c2-border" />}
              </div>
              <div className="pb-3.5">
                <div className={`text-[13.5px] ${active ? 'font-extrabold text-c2-ink' : 'font-semibold text-c2-ink-soft'}`}>
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-c2-md bg-c2-fill p-3.5 text-xs font-semibold leading-relaxed text-c2-ink">
        {paymentsEnabled
          ? t('orderDetail.progressNote', { price: order.calloutPrice + (order.workPrice ?? 0) })
          : `Согласованная стоимость работ: ${order.workPrice ?? 0} ₸. Расчёт происходит напрямую с мастером.`}
      </div>
      <div className="mt-auto" />
      <Link
        to="/support"
        className="rounded-c2-pill border-[1.5px] border-c2-border p-3.5 text-center text-sm font-extrabold text-c2-ink"
      >
        {t('orderDetail.support')}
      </Link>
    </div>
  );
}
