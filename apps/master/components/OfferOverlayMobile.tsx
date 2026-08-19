'use client';
import { useMasterPresence } from '@/lib/masterPresence';
import { useCountdown } from '@/lib/useCountdown';

export function OfferOverlayMobile() {
  const { offer, offerNote, acceptingOffer, acceptOffer, dismissOfferNote } = useMasterPresence();
  const secondsLeft = useCountdown(offer?.deadline ?? null);

  if (!offer) {
    if (!offerNote) return null;
    return (
      <div className="fixed inset-x-4 bottom-20 z-50 flex items-start gap-3 rounded-md border border-border bg-fill-soft p-3 text-sm text-ink-soft shadow-lg md:hidden">
        <p className="flex-1">{offerNote}</p>
        <button type="button" onClick={dismissOfferNote} aria-label="Скрыть уведомление" className="text-ink-soft">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#123B52] p-5 pb-8 text-white md:hidden">
      <div className="mb-auto mt-10 text-center">
        <div className="inline-block rounded-pill bg-danger px-4 py-1.5 text-sm font-extrabold">
          {secondsLeft} с
        </div>
      </div>
      <div className="space-y-3 text-center">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-white/70">
          Новая заявка{offer.district ? ` · ${offer.district}` : ''} · {offer.distanceKm} км
        </div>
        <h2 className="text-2xl font-extrabold">{offer.category}</h2>
        <p className="text-sm text-white/80">{offer.description}</p>
        <p className="text-xs text-white/60">Точный адрес — после принятия</p>
        {offer.freePilot ? (
          <div className="rounded-md bg-white/10 p-3 text-sm font-semibold">
            Бесплатный пилот: стоимость работ согласовывается с клиентом напрямую.
          </div>
        ) : (
          <div className="text-xl font-extrabold">Вам за выезд {offer.compensation} ₸</div>
        )}
      </div>
      <div className="mt-8 space-y-2">
        <button
          type="button"
          disabled={acceptingOffer}
          onClick={acceptOffer}
          className="w-full rounded-pill bg-white p-4 text-base font-extrabold text-[#123B52] disabled:opacity-40"
        >
          {acceptingOffer ? 'Принимаем…' : `Принять (${secondsLeft} с)`}
        </button>
        <button type="button" onClick={dismissOfferNote} className="w-full p-2 text-sm font-bold text-white/70">
          Пропустить
        </button>
      </div>
    </div>
  );
}
