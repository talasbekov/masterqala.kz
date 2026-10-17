'use client';
import {useEffect,useState} from 'react';
import MapView from '@/components/MapView';
import {getSocket} from '@/lib/socket';
import {validOrderPoint} from './pilot-state';
import {urgentCopy} from './copy';
export function UrgentMap({id,lat,lng,searching,language}:{id:string;lat:number|null;lng:number|null;searching:boolean;language:'ru'|'kk'|'en'}){
 const [position,setPosition]=useState<{lat:number;lng:number;at:number}|null>(null),c=urgentCopy[language];
 useEffect(()=>{const socket=getSocket();const update=(event:{orderId:string;lat:number;lng:number})=>{if(event.orderId===id&&!searching&&validOrderPoint(event.lat,event.lng))setPosition({lat:event.lat,lng:event.lng,at:Date.now()});};socket.on('master:location',update);return()=>{socket.off('master:location',update);};},[id,searching]);
 if(!validOrderPoint(lat,lng))return <p>{c.mapMissing}</p>;
 return <><div className="urgent-map"><MapView mode={searching?'pulse':'tracking'} center={{lat:lat!,lng:lng!}} masterPosition={position} height="100%"/></div>{!searching&&<p>{position?c.location+' · '+new Intl.DateTimeFormat(language,{hour:'2-digit',minute:'2-digit'}).format(position.at):c.locationMissing}</p>}</>;
}
