'use client';
import { Alert, Badge, Button, Skeleton } from '@masterqala/ui';
import { statusLabel, statusTone, type OrderDetail } from '@/lib/orders';
import { formatDateTime } from '@/lib/format';

/** Правая панель списка заказов: карточка выбранной заявки. */
export function OrderDetailPanel({
  selected,
  detail,
  loading,
  error,
  onAssignClick,
}: {
  selected: boolean;
  detail: OrderDetail | null;
  loading: boolean;
  error: string;
  onAssignClick: () => void;
}) {
  return (
    <section
      aria-label="Карточка заказа"
      className="w-full shrink-0 rounded-lg border border-border bg-surface p-5 lg:w-96"
    >
      {!selected && <p className="text-sm text-ink-soft">Выберите заказ в таблице</p>}
      {selected && loading && (
        <div role="status" aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Загрузка карточки заказа</span>
          <Skeleton shape="text" className="w-2/3" />
          <Skeleton shape="text" className="w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
      {selected && error && <Alert tone="danger">{error}</Alert>}
      {selected && !loading && detail && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-ink">
              #{detail.id.slice(0, 8)} · {detail.category}
            </h2>
            <Badge tone={statusTone(detail.type, detail.status)}>
              {statusLabel(detail.type, detail.status)}
            </Badge>
          </div>

          <p className="text-sm text-ink-soft">
            {detail.address} · {detail.district}
          </p>
          <p className="text-xs text-ink-soft">Создана {formatDateTime(detail.createdAt)}</p>

          <div className="rounded-md bg-fill-soft p-3">
            <h3 className="text-2xs font-bold uppercase text-ink-soft">Платежи</h3>
            {detail.type === 'urgent' ? (
              <p className="mt-1 text-sm font-extrabold text-ink">
                Выезд {detail.calloutPrice} ₸ · Сбор {detail.serviceFee} ₸
                {detail.workPrice !== null && <> · Работа {detail.workPrice} ₸</>}
              </p>
            ) : (
              <p className="mt-1 text-sm font-extrabold text-ink">
                Бюджет {detail.budget ?? '—'} ₸
                {detail.workPrice !== null && <> · Работа {detail.workPrice} ₸</>}
              </p>
            )}
          </div>

          <h3 className="text-sm font-extrabold text-ink">Клиент</h3>
          <p className="text-sm text-ink-soft">
            {detail.client.name ?? detail.client.phone} · {detail.client.phone}
          </p>

          {detail.master && (
            <>
              <h3 className="text-sm font-extrabold text-ink">Мастер</h3>
              <p className="text-sm text-ink-soft">
                {detail.master.name ?? detail.master.phone} · {detail.master.phone}
              </p>
            </>
          )}

          <h3 className="text-sm font-extrabold text-ink">Таймлайн</h3>
          <ul className="flex flex-col gap-2">
            {detail.timeline.map((event, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="text-ink-soft">{formatDateTime(event.at)}</span>
                <span className="font-bold text-ink">{event.event}</span>
              </li>
            ))}
          </ul>

          {detail.canAssign && (
            <Button size="sm" onClick={onAssignClick}>
              Назначить мастера вручную
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
