'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useLocale} from '@masterqala/ui';
import {api} from '../../lib/api';
import {serviceCopy} from './copy';
import {designCopy} from './design-copy';
import './desktop-service.css';
type Mode='FREE_PILOT'|'DIRECT_PAYMENT'|'PAID_MOCK';
type State={kind:'loading'|'error'|'unavailable'}|{kind:'ready';mode:Mode};
// The shared provider's safe default cannot distinguish a failed read from a
// confirmed pilot. Only a validated public response can name the current mode.
function paymentMode(value:unknown):Mode|null {
 if(!value||typeof value!=='object')return null;
 const config=value as Record<string,unknown>,mode=config.commercialMode;
 if(mode!=='FREE_PILOT'&&mode!=='DIRECT_PAYMENT'&&mode!=='PAID_MOCK')return null;
 const enabled=mode==='PAID_MOCK';
 return ['paymentsEnabled','leadCreditsEnabled','payoutsEnabled'].every(key=>config[key]===enabled)?mode:null;
}
export function PaymentsAvailability(){
 const {language}=useLocale(),copy=serviceCopy[language],design=designCopy[language];
 const [attempt,setAttempt]=useState(0),[state,setState]=useState<State>({kind:'loading'});
 useEffect(()=>{
  const controller=new AbortController();setState({kind:'loading'});
  api('/config/public',{signal:controller.signal}).then(value=>{
   if(controller.signal.aborted)return;
   const mode=paymentMode(value);setState(mode?{kind:'ready',mode}:{kind:'unavailable'});
  }).catch(()=>{if(!controller.signal.aborted)setState({kind:'error'});});
  return()=>controller.abort();
 },[attempt]);
 const modeKey=state.kind==='ready'?(state.mode==='FREE_PILOT'?'pilot':state.mode==='DIRECT_PAYMENT'?'direct':'mock'):null;
 return <section className="desktop-service desktop-service-payments" aria-labelledby="payment-service-heading">
  <p className="desktop-service-status">{state.kind==='ready'?`${state.mode} · ${design.paymentStatus}`:copy.payments}</p>
  <header className="desktop-service-heading"><h1 id="payment-service-heading">{copy.payments}</h1><p>{design.paymentIntro}</p></header>
  <div className="desktop-service-columns"><div className="desktop-service-stack">
  {state.kind==='loading'&&<section className="desktop-service-card" role="status" aria-live="polite"><h2>{copy.loading}</h2><p>{copy.loadingNote}</p></section>}
  {state.kind==='error'&&<section className="desktop-service-card" role="alert"><h2>{copy.error}</h2><p>{copy.errorNote}</p><button type="button" className="desktop-service-action desktop-service-secondary" data-payment-retry onClick={()=>{setState({kind:'loading'});setAttempt(value=>value+1);}}>{copy.retry}</button></section>}
  {state.kind==='unavailable'&&<section className="desktop-service-card" data-payment-unavailable><h2>{copy.unavailable}</h2><p>{copy.unavailableNote}</p></section>}
  {state.kind==='ready'&&modeKey&&<section className="desktop-service-card" data-payment-mode={state.mode}><h2>{design.cardHeading}</h2><p>{design.cardBody}</p><p className="desktop-payment-mode-note"><strong>{copy[modeKey]}. </strong>{copy[`${modeKey}Note`]}</p></section>}
  <nav className="desktop-service-actions"><Link href="/orders" className="desktop-service-action">{copy.orders}</Link><Link href="/support" className="desktop-service-action">{copy.support}</Link><span aria-disabled="true" className="desktop-service-action desktop-service-disabled">{design.addCard}</span></nav>
  </div><aside className="desktop-service-stack"><section className="desktop-service-card"><h2>{design.termsHeading}</h2><p>{design.termsBody}</p></section><section className="desktop-service-card"><h2>{design.unknownHeading}</h2><p>{design.unknownBody}</p></section></aside></div>
 </section>;
}
