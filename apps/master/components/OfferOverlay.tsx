'use client';
import {useEffect,useState} from 'react';
import {Button,Dialog,useLocale} from '@masterqala/ui';
import {useMasterPresence} from '@/lib/masterPresence';
import {useCountdown} from '@/lib/useCountdown';
import {OfferOverlayMobile} from './OfferOverlayMobile';
import {offerNoticeText,urgentCopy} from './desktop-urgent/copy';
import './desktop-urgent/urgent.css';

export function OfferOverlay() {
 const {offer,offerNote,acceptingOffer,acceptOffer,declineOffer,dismissOfferNote}=useMasterPresence();
 const {language,t,formatMoney}=useLocale(),c=urgentCopy[language];
 const [desktop,setDesktop]=useState(false),[online,setOnline]=useState(true);
 const secondsLeft=useCountdown(offer?.deadline??null);
 useEffect(()=>{const query=window.matchMedia('(min-width:768px)');const resize=()=>setDesktop(query.matches);const network=()=>setOnline(navigator.onLine);resize();network();query.addEventListener('change',resize);window.addEventListener('online',network);window.addEventListener('offline',network);return()=>{query.removeEventListener('change',resize);window.removeEventListener('online',network);window.removeEventListener('offline',network);};},[]);
 if(!desktop)return <OfferOverlayMobile/>;
 const note=offerNoticeText(offerNote,language);
 if(!offer)return note?<aside role="status" className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100%_-_48px)] rounded-lg border border-border bg-surface p-6 shadow-lg"><h2 className="font-semibold text-primary">{c.offerNote}</h2><p className="my-4 break-words text-sm text-ink-soft">{note}</p><Button variant="secondary" onClick={dismissOfferNote}>{c.dismiss}</Button></aside>:null;
 const expired=!Number.isFinite(secondsLeft)||secondsLeft<=0;
 return <Dialog open title={c.offer} busy={acceptingOffer} onClose={()=>void declineOffer()}><div className="mq-urgent-confirm"><p className="text-xs text-ink-soft">{c.offer} · {offer.distanceKm} {c.distance}</p><h2>{offer.category}</h2><p className="whitespace-pre-wrap break-words">{offer.description}</p>{offer.district&&<p>{offer.district}</p>}<p className="mq-urgent-notice">{offer.directPayment?t('directCreateNote'):offer.freePilot?c.pilotNote:`${c.compensation}: ${formatMoney(offer.compensation)}`}</p>{offer.freePilot&&!offer.directPayment&&<p className="text-xs text-ink-soft">{c.pilot}</p>}{!online&&<p role="status">{c.offline}</p>}{expired&&<p role="status">{c.expired}</p>}<Button variant="accent" disabled={acceptingOffer||expired||!online} loading={acceptingOffer} loadingLabel={c.busy} onClick={()=>void acceptOffer()}>{c.accept} · {secondsLeft} {c.seconds}</Button><Button variant="secondary" disabled={acceptingOffer||!online} onClick={()=>void declineOffer()}>{c.skip}</Button></div></Dialog>;
}
