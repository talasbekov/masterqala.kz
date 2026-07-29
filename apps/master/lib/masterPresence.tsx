'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSocket } from './socket';

export interface UrgentOffer {
  orderId: string;
  category: string;
  description: string;
  address?: string;
  distanceKm: number;
  compensation: number;
  freePilot: boolean;
  deadline: string;
}

interface MasterPresenceCtx {
  online: boolean;
  connected: boolean;
  geoDenied: boolean;
  offer: UrgentOffer | null;
  offerNote: string;
  goOnline: () => void;
  goOffline: () => void;
  dismissOfferNote: () => void;
}

const Ctx = createContext<MasterPresenceCtx>({
  online: false,
  connected: false,
  geoDenied: false,
  offer: null,
  offerNote: '',
  goOnline: () => {},
  goOffline: () => {},
  dismissOfferNote: () => {},
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
  const [online, setOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);
  const [offer, setOffer] = useState<UrgentOffer | null>(null);
  const [offerNote, setOfferNote] = useState('');
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
        const socket = getSocket();
        socket.emit('presence:online', { lat: position.coords.latitude, lng: position.coords.longitude });
        setOnline(true);
        geoTimer.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition((next) =>
            socket.emit('geo:update', { lat: next.coords.latitude, lng: next.coords.longitude }),
          );
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

  return (
    <Ctx.Provider value={{ online, connected, geoDenied, offer, offerNote, goOnline, goOffline, dismissOfferNote }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMasterPresence = () => useContext(Ctx);
