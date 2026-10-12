'use client';
import {Button,useLocale} from '@masterqala/ui';
import { useMasterPresence } from '@/lib/masterPresence';
import { useCountdown } from '@/lib/useCountdown';

export function OfferOverlayMobile() {
  const { offer, offerNote, acceptingOffer, acceptOffer, declineOffer, dismissOfferNote } = useMasterPresence();
  const {t}=useLocale();
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

  if(offer.directPayment)return <div role="dialog" aria-label={t('incoming')} className="fixed inset-0 z-50 flex flex-col bg-surface text-primary md:hidden"><header className="flex min-h-14 items-center justify-between px-6 font-semibold"><span>{t('incoming')}</span><span>{t('seconds',{seconds:secondsLeft})}</span></header><div className="flex flex-1 flex-col gap-4 overflow-auto p-6"><span className="w-fit rounded-md bg-accent px-3 py-2 text-xs font-semibold">{t('urgentDistance',{distance:offer.distanceKm})}</span><h1 className="text-[28px] font-medium leading-[34px]">{offer.category}</h1><p className="whitespace-pre-wrap break-words text-base text-ink">{offer.description}</p><div className="space-y-3 rounded-lg bg-fill-soft p-4 text-sm"><p>{offer.district}</p><p>{t('addressAfter')}</p></div><div className="rounded-lg bg-primary p-4 text-sm leading-relaxed text-white">{t('directCreateNote')}</div></div><footer className="flex flex-col gap-2 px-6 pb-[max(16px,env(safe-area-inset-bottom))]"><Button variant="accent" disabled={acceptingOffer||secondsLeft===0} onClick={()=>void acceptOffer()}>{t('acceptOffer')}</Button><Button variant="secondary" disabled={acceptingOffer} onClick={()=>void declineOffer()}>{t('skip')}</Button></footer></div>;

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
        {offer.directPayment?<div className="rounded-lg bg-fill-soft p-4 text-sm leading-relaxed text-primary">{t('directCreateNote')}</div>:offer.freePilot ? (
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
          disabled={acceptingOffer||secondsLeft===0}
          onClick={acceptOffer}
          className="w-full rounded-pill bg-white p-4 text-base font-extrabold text-[#123B52] disabled:opacity-40"
        >
          {acceptingOffer ? 'Принимаем…' : `Принять (${secondsLeft} с)`}
        </button>
        <button type="button" onClick={()=>void declineOffer()} className="w-full p-2 text-sm font-bold text-white/70">
          Пропустить
        </button>
      </div>
    </div>
  );
}
