'use client';
import {useEffect,useState,type ReactNode} from 'react';
/** Four-step flow retained; the mobile map is mounted only for address editing. */
export function NewOrderLayout({step,header,progress,map,children,mapLabel}:{step:number;header:ReactNode;progress:ReactNode;map:ReactNode;children:ReactNode;mapLabel?:string}) {
 const [desktop,setDesktop]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(min-width: 1024px)');
  const update=(event:MediaQueryListEvent)=>setDesktop(event.matches);
  setDesktop(media.matches);media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 return <div className="mq-new-order-layout" data-step={step}>
  <header className="mq-new-order-header">{header}</header>
  <div className="mq-new-order-progress">{progress}</div>
  <div className="mq-new-order-columns">
   <section className="mq-new-order-card" aria-labelledby="new-order-heading">{children}</section>
   {(desktop||step===3)&&<section className="mq-new-order-map" aria-label={mapLabel}>{map}</section>}
  </div>
 </div>;
}
