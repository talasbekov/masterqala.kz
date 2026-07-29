'use client';
import { useMasterPresence } from '@/lib/masterPresence';
import { useCountdown } from '@/lib/useCountdown';

export function OfferOverlay() {
  const { offer, offerNote, dismissOfferNote } = useMasterPresence();
  const secondsLeft = useCountdown(offer?.deadline ?? null);

  if (!offer) {
    if (!offerNote) return null;
    return (
      <div className="fixed bottom-6 right-6 z-50 flex w-full max-w-[360px] items-start gap-3 rounded-md border border-border bg-fill-soft p-3 text-sm text-ink-soft shadow-lg">
        <p className="flex-1">{offerNote}</p>
        <button
          type="button"
          onClick={dismissOfferNote}
          aria-label="Скрыть уведомление"
          className="text-ink-soft hover:text-ink"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6">
      <div className="w-full max-w-[420px] space-y-3 rounded-lg bg-surface p-6 text-center shadow-xl">
        <div className="text-xs font-extrabold uppercase text-ink-soft">
          Новая заявка · {offer.distanceKm} км
        </div>
        <h2 className="text-xl font-extrabold text-ink">{offer.category}</h2>
        <p className="text-sm text-ink-soft">{offer.description}</p>
        {offer.address && <p className="text-sm text-ink-soft">{offer.address}</p>}
        {offer.freePilot ? (
          <div className="rounded-md bg-fill-soft p-3 text-sm font-semibold text-ink">
            Бесплатный пилот: стоимость работ согласовывается с клиентом напрямую.
          </div>
        ) : (
          <div className="text-lg font-extrabold text-primary">Компенсация выезда: {offer.compensation} ₸</div>
        )}
        <div className="text-sm font-bold text-ink-soft">Осталось {secondsLeft} с</div>
        <div className="rounded-md border border-dashed border-border p-3 text-xs text-ink-soft">
          Приём заявки появится в Фазе 2 — сейчас можно только просмотреть оффер.
        </div>
      </div>
    </div>
  );
}
