'use client';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from '@masterqala/ui';
import { STEPPER_STEPS } from '@/lib/orderStatus';
import type { OrderDetail } from '@/lib/orderTypes';

export default function ProgressView({ order }: { order: OrderDetail }) {
  const { t } = useTranslation();
  const paymentsEnabled = order.commercialMode !== 'FREE_PILOT' && order.freePilot !== true;
  const currentIdx = STEPPER_STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3.5 px-5 pt-1.5 pb-3.5 sm:px-8 sm:py-6">
      <h1 className="text-lg font-extrabold text-ink">
        {t('orderDetail.orderNumber', { id: order.id.slice(0, 8) })}
      </h1>
      <ol className="flex flex-col">
        {STEPPER_STEPS.map((s, i) => {
          const done = i < currentIdx || (i === currentIdx && order.status !== s.status);
          const active = s.status === order.status;
          return (
            <li key={s.status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex size-5.5 items-center justify-center rounded-full border-2 text-on-primary ${
                    done || active ? 'border-primary bg-primary' : 'border-border bg-surface'
                  }`}
                  aria-hidden="true"
                >
                  {done ? <CheckIcon size={12} /> : null}
                </span>
                {i < STEPPER_STEPS.length - 1 && <span className="min-h-4.5 w-0.5 flex-1 bg-border" />}
              </div>
              <div className="pb-3.5">
                <span
                  className={`text-xs ${active ? 'font-extrabold text-ink' : 'font-semibold text-ink-soft'}`}
                  aria-current={active ? 'step' : undefined}
                >
                  {s.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="rounded-md bg-surface-sunken p-3.5 text-xs leading-relaxed font-semibold text-on-fill">
        {paymentsEnabled
          ? t('orderDetail.progressNote', { price: order.calloutPrice + (order.workPrice ?? 0) })
          : `Согласованная стоимость работ: ${order.workPrice ?? 0} ₸. Расчёт происходит напрямую с мастером.`}
      </p>
      <div className="mt-auto" />
      <Link
        href="/support"
        className="inline-flex min-h-11 items-center justify-center rounded-pill border border-border-strong bg-surface px-4 text-base font-bold text-ink transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-surface-sunken"
      >
        {t('orderDetail.support')}
      </Link>
    </div>
  );
}
