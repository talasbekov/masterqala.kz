'use client';
import { Badge, BoltIcon, Button, Card, CloseIcon, IconButton } from '@masterqala/ui';
import { useMasterPresence } from '@/lib/masterPresence';
import { useCountdown } from '@/lib/useCountdown';

export function OfferOverlay() {
  const { offer, offerNote, acceptingOffer, acceptOffer, dismissOfferNote } = useMasterPresence();
  const secondsLeft = useCountdown(offer?.deadline ?? null);

  if (!offer) {
    if (!offerNote) return null;
    return (
      <div
        role="status"
        className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full sm:max-w-sm"
      >
        <Card raised padding="sm" className="flex items-start gap-2 bg-fill-soft text-sm text-ink-soft">
          <p className="flex-1 pt-2.5">{offerNote}</p>
          {/* Единственная кнопка-иконка в кабинете: доступное имя обязательно,
              его требует тип IconButton. */}
          <IconButton label="Скрыть уведомление" icon={<CloseIcon />} onClick={dismissOfferNote} />
        </Card>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center sm:p-6"
    >
      {/* Срочная заявка — единственное место в кабинете, где уместен оранжевый:
          в этой системе он означает срочность, а не «ещё один яркий цвет». */}
      <Card raised padding="lg" className="w-full max-w-md space-y-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <Badge tone="urgent" icon={<BoltIcon size={14} />}>
            Срочная заявка
          </Badge>
          <span className="text-2xs font-extrabold uppercase text-ink-soft">{offer.distanceKm} км</span>
        </div>
        <h2 id="offer-title" className="text-xl font-extrabold text-ink">
          {offer.category}
        </h2>
        <p className="text-sm text-ink-soft">{offer.description}</p>
        {offer.address && <p className="text-sm text-ink-soft">{offer.address}</p>}
        {offer.freePilot ? (
          <p className="rounded-md bg-fill-soft p-3 text-sm font-semibold text-ink">
            Бесплатный пилот: стоимость работ согласовывается с клиентом напрямую.
          </p>
        ) : (
          <p className="text-lg font-extrabold text-primary">
            Компенсация выезда: {offer.compensation} ₸
          </p>
        )}
        <Button
          variant="urgent"
          size="lg"
          fullWidth
          loading={acceptingOffer}
          loadingLabel="Принимаем…"
          onClick={acceptOffer}
        >
          Принять ({secondsLeft} с)
        </Button>
      </Card>
    </div>
  );
}
