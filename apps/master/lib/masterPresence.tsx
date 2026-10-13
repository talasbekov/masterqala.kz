'use client';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { getSocket, resetSocket } from './socket';
import {useAuth} from './auth';

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
  availabilityPending: boolean;
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
  availabilityPending: false,
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

export function MasterPresenceProvider({children}:{children:ReactNode}) {
  const {user}=useAuth();
  // Owner-keyed lifetime prevents old reads/actions/location from entering another account.
  return user ? <MasterPresenceSession key={user.id}>{children}</MasterPresenceSession> : <Ctx.Provider value={inactivePresence}>{children}</Ctx.Provider>;
}
const inactivePresence:MasterPresenceCtx={online:false,availabilityPending:false,connected:false,geoDenied:false,offer:null,offerNote:'',myPosition:null,acceptingOffer:false,goOnline:()=>{},goOffline:()=>{},dismissOfferNote:()=>{},acceptOffer:async()=>{},declineOffer:async()=>{}};

function MasterPresenceSession({children}:{children:ReactNode}){
 const router=useRouter();
 const [online,setOnline]=useState(false),[availabilityPending,setAvailabilityPending]=useState(false),[connected,setConnected]=useState(false),[geoDenied,setGeoDenied]=useState(false);
 const [offer,setOffer]=useState<UrgentOffer|null>(null),[offerNote,setOfferNote]=useState(''),[myPosition,setMyPosition]=useState<LatLng|null>(null),[acceptingOffer,setAcceptingOffer]=useState(false);
 const live=useRef(false),onlineIntent=useRef(false),locationPending=useRef(false),locationRevision=useRef(0),offerRevision=useRef(0),offerLock=useRef(false),currentOffer=useRef<UrgentOffer|null>(null);
 const geoTimer=useRef<ReturnType<typeof setInterval>|null>(null);
 const stopTimer=()=>{if(geoTimer.current!==null)clearInterval(geoTimer.current);geoTimer.current=null;};
 const replaceOffer=(value:UrgentOffer|null)=>{currentOffer.current=value;setOffer(value);};
 useLayoutEffect(()=>{live.current=true;return()=>{live.current=false;locationRevision.current++;offerRevision.current++;stopTimer();};},[]);
 useEffect(()=>{
  const socket=getSocket();setConnected(socket.connected);
  const restore=async()=>{
   const revision=++offerRevision.current;
   try{
    const {offer:pending}=await api('/master/pending-offer');
    if(!live.current||offerRevision.current!==revision)return;
    const next=pending&&Date.parse(pending.deadline)>Date.now()?pending:null;
    replaceOffer(next??(currentOffer.current?.directPayment?null:currentOffer.current));
   }catch{/* Socket delivery remains usable; reconnect/foreground retries the GET. */}
  };
  const onConnect=()=>{if(live.current){setConnected(true);void restore();}};
  const onDisconnect=()=>{if(live.current)setConnected(false);};
  const foreground=()=>{if(live.current&&document.visibilityState==='visible')void restore();};
  const onOffer=(incoming:UrgentOffer)=>{if(!live.current)return;offerRevision.current++;replaceOffer(incoming);setOfferNote('');beepAndVibrate();};
  const onClosed=(payload:{orderId:string;offerId?:string;reason:string})=>{
   if(!live.current)return;offerRevision.current++;
   const current=currentOffer.current;
   if(current?.orderId===payload.orderId&&(!payload.offerId||!current.offerId||current.offerId===payload.offerId))replaceOffer(null);
   setOfferNote(payload.reason);
  };
  socket.on('connect',onConnect);socket.on('disconnect',onDisconnect);socket.on('offer:new',onOffer);socket.on('offer:closed',onClosed);
  document.addEventListener('visibilitychange',foreground);
  if(socket.connected)void restore();
  return()=>{
   document.removeEventListener('visibilitychange',foreground);
   socket.off('connect',onConnect);socket.off('disconnect',onDisconnect);socket.off('offer:new',onOffer);socket.off('offer:closed',onClosed);
   stopTimer();resetSocket();
  };
 },[]);
 const goOnline=useCallback(()=>{
  if(!live.current||onlineIntent.current||locationPending.current)return;
  if(!navigator.geolocation){setGeoDenied(true);return;}
  const revision=++locationRevision.current;locationPending.current=true;setAvailabilityPending(true);setGeoDenied(false);
  const valid=()=>live.current&&locationRevision.current===revision;
  navigator.geolocation.getCurrentPosition(position=>{
   if(!valid())return;
   const coords={lat:position.coords.latitude,lng:position.coords.longitude};const socket=getSocket();
   locationPending.current=false;onlineIntent.current=true;setAvailabilityPending(false);setOnline(true);setMyPosition(coords);socket.emit('presence:online',coords);
   stopTimer();geoTimer.current=setInterval(()=>{
    if(!valid()||!onlineIntent.current)return;
    navigator.geolocation.getCurrentPosition(next=>{
     if(!valid()||!onlineIntent.current)return;
     const coords={lat:next.coords.latitude,lng:next.coords.longitude};socket.emit('geo:update',coords);setMyPosition(coords);
    });
   },30000);
  },()=>{if(valid()){locationPending.current=false;setAvailabilityPending(false);setGeoDenied(true);}});
 },[]);
 const goOffline=useCallback(()=>{
  if(!live.current)return;
  locationRevision.current++;locationPending.current=false;onlineIntent.current=false;stopTimer();setAvailabilityPending(false);setOnline(false);getSocket().emit('presence:offline');
 },[]);
 const dismissOfferNote=useCallback(()=>{if(live.current)setOfferNote('');},[]);
 const clearAccepted=(captured:UrgentOffer)=>{const current=currentOffer.current;if(current?.orderId===captured.orderId&&current.offerId===captured.offerId)replaceOffer(null);};
 const acceptOffer=useCallback(async()=>{
  if(!live.current||!offer||currentOffer.current!==offer||offerLock.current||!(Date.parse(offer.deadline)>Date.now())||!navigator.onLine)return;
  offerRevision.current++;offerLock.current=true;setAcceptingOffer(true);
  try{const accepted=await api(`/orders/${offer.orderId}/accept`,{method:'POST'});if(!live.current)return;clearAccepted(offer);router.push(accepted.lifecycleVersion>=2?`/order/${offer.orderId}`:'/');}
  catch(error){if(live.current){clearAccepted(offer);setOfferNote((error as Error).message);}}
  finally{if(live.current){offerRevision.current++;offerLock.current=false;setAcceptingOffer(false);}}
 },[offer,router]);
 const declineOffer=useCallback(async()=>{
  if(!live.current||!offer||currentOffer.current!==offer||offerLock.current||!navigator.onLine)return;
  offerRevision.current++;offerLock.current=true;setAcceptingOffer(true);
  try{if(offer.directPayment)await api(`/orders/${offer.orderId}/decline`,{method:'POST'});if(live.current)clearAccepted(offer);}
  catch(error){if(live.current)setOfferNote((error as Error).message);}
  finally{if(live.current){offerRevision.current++;offerLock.current=false;setAcceptingOffer(false);}}
 },[offer]);
 return <Ctx.Provider value={{online,availabilityPending,connected,geoDenied,offer,offerNote,myPosition,acceptingOffer,goOnline,goOffline,dismissOfferNote,acceptOffer,declineOffer}}>{children}</Ctx.Provider>;
}

export const useMasterPresence = () => useContext(Ctx);
