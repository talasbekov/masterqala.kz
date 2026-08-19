'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { getSocket } from './socket';

export interface UrgentOffer {
  orderId: string;
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
  const geoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    setConnected(socket.connected);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onOffer = (incoming: UrgentOffer) => {
      setOffer(incoming);
      setOfferNote('');
      beepAndVibrate();
    };
    const onOfferClosed = (payload: { orderId: string; reason: string }) => {
      setOffer((current) => (current?.orderId === payload.orderId ? null : current));
      setOfferNote(payload.reason);
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('offer:new', onOffer);
    socket.on('offer:closed', onOfferClosed);
    return () => {
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
    if (!offer) return;
    setAcceptingOffer(true);
    try {
      await api(`/orders/${offer.orderId}/accept`, { method: 'POST' });
      setOffer(null);
      router.push('/');
    } catch (e) {
      setOffer(null);
      setOfferNote((e as Error).message);
    } finally {
      setAcceptingOffer(false);
    }
  }, [offer, router]);

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
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useMasterPresence = () => useContext(Ctx);
