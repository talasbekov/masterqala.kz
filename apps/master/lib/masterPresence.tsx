'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { getSocket } from './socket';

export interface UrgentOffer {
  orderId: string;
  offerId?:string;
  directPayment?:boolean;
  category: string;
  description: string;
  district?: string;
  distanceKm: number;
  compensation: number;
  freePilot: boolean;
  deadline: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

interface MasterPresenceCtx {
  online: boolean;
  connected: boolean;
  geoDenied: boolean;
  offer: UrgentOffer | null;
  offerNote: string;
  myPosition: LatLng | null;
  acceptingOffer: boolean;
  goOnline: () => void;
  goOffline: () => void;
  dismissOfferNote: () => void;
  acceptOffer: () => Promise<void>;
  declineOffer:()=>Promise<void>;
}

const Ctx = createContext<MasterPresenceCtx>({
  online: false,
  connected: false,
  geoDenied: false,
  offer: null,
  offerNote: '',
  myPosition: null,
  acceptingOffer: false,
  goOnline: () => {},
  goOffline: () => {},
  dismissOfferNote: () => {},
  acceptOffer: async () => {},
  declineOffer:async()=>{},
});

function beepAndVibrate() {
  try {
    const audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch {
    // Звук недоступен — вибрация остаётся резервным уведомлением.
  }
  navigator.vibrate?.([200, 100, 200]);
}

export function MasterPresenceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [offer, setOffer] = useState<UrgentOffer | null>(null);
  const [offerNote, setOfferNote] = useState('');
  const [myPosition, setMyPosition] = useState<LatLng | null>(null);
  const [acceptingOffer, setAcceptingOffer] = useState(false);
  const offerLock=useRef(false),offerRevision=useRef(0);
  const geoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    setConnected(socket.connected);
    let mounted=true;
    const restore=async()=>{
      const current=++offerRevision.current;
      try{const {offer:pending}=await api('/master/pending-offer');if(mounted&&offerRevision.current===current)setOffer(previous=>(pending&&Date.parse(pending.deadline)>Date.now()?pending:null)??(previous?.directPayment?null:previous));}catch{/* Socket delivery remains usable; retry at the next reconnect/foreground. */}
    };
    const onConnect = () => {setConnected(true);void restore();};
    const foreground=()=>{if(document.visibilityState==='visible')void restore();};
    const onDisconnect = () => setConnected(false);
    const onOffer = (incoming: UrgentOffer) => {
      ++offerRevision.current;setOffer(incoming);
      setOfferNote('');
      beepAndVibrate();
    };
    const onOfferClosed = (payload: { orderId: string; offerId?:string; reason: string }) => {
      ++offerRevision.current;setOffer((current) => (current?.orderId === payload.orderId && (!payload.offerId||!current.offerId||current.offerId===payload.offerId) ? null : current));
      setOfferNote(payload.reason);
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('offer:new', onOffer);
    socket.on('offer:closed', onOfferClosed);
    document.addEventListener('visibilitychange',foreground);
    if(socket.connected)void restore();
    return () => {
      mounted=false;document.removeEventListener('visibilitychange',foreground);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('offer:new', onOffer);
      socket.off('offer:closed', onOfferClosed);
      if (geoTimer.current) clearInterval(geoTimer.current);
    };
  }, []);

  const goOnline = useCallback(() => {
    setGeoDenied(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        const socket = getSocket();
        socket.emit('presence:online', coords);
        setOnline(true);
        setMyPosition(coords);
        geoTimer.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition((next) => {
            const nextCoords = { lat: next.coords.latitude, lng: next.coords.longitude };
            socket.emit('geo:update', nextCoords);
            setMyPosition(nextCoords);
          });
        }, 30000);
      },
      () => setGeoDenied(true),
    );
  }, []);

  const goOffline = useCallback(() => {
    getSocket().emit('presence:offline');
    setOnline(false);
    if (geoTimer.current) clearInterval(geoTimer.current);
  }, []);

  const dismissOfferNote = useCallback(() => setOfferNote(''), []);

  const acceptOffer = useCallback(async () => {
    if (!offer||offerLock.current||Date.parse(offer.deadline)<=Date.now()||!navigator.onLine) return;
    ++offerRevision.current;offerLock.current=true;setAcceptingOffer(true);
    try {
      const accepted=await api(`/orders/${offer.orderId}/accept`, { method: 'POST' });
      setOffer(current=>current?.orderId===offer.orderId?null:current);
      router.push(accepted.lifecycleVersion>=2?`/order/${offer.orderId}`:'/');
    } catch (e) {
      setOffer(current=>current?.orderId===offer.orderId?null:current);
      setOfferNote((e as Error).message);
    } finally {
      ++offerRevision.current;offerLock.current=false;setAcceptingOffer(false);
    }
  }, [offer, router]);

  const declineOffer=useCallback(async()=>{
    if(!offer||offerLock.current||!navigator.onLine)return;
    ++offerRevision.current;offerLock.current=true;setAcceptingOffer(true);
    try{if(offer.directPayment)await api(`/orders/${offer.orderId}/decline`,{method:'POST'});setOffer(current=>current?.orderId===offer.orderId?null:current);}
    catch(e){setOfferNote((e as Error).message);}
    finally{++offerRevision.current;offerLock.current=false;setAcceptingOffer(false);}
  },[offer]);

  return (
    <Ctx.Provider
      value={{
        online,
        connected,
        geoDenied,
        offer,
        offerNote,
        myPosition,
        acceptingOffer,
        goOnline,
        goOffline,
        dismissOfferNote,
        acceptOffer,
        declineOffer,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useMasterPresence = () => useContext(Ctx);
