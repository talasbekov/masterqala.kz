'use client';
import {Button,useLocale} from '@masterqala/ui';
import {useAuth} from '../lib/auth';
import {useMasterPresence} from '../lib/masterPresence';
import {masterSurfaceText} from '../lib/masterSurfaceCopy';
/** Local requested mode is distinct from connection and never asserts server eligibility. */
export function MasterAvailabilityControl({compact=false}:{compact?:boolean}){
 const {language}=useLocale(),{user}=useAuth();const copy=(key:Parameters<typeof masterSurfaceText>[1])=>masterSurfaceText(language,key);
 const {online,availabilityPending,connected,geoDenied,goOnline,goOffline}=useMasterPresence();
 return <section data-master-availability className={`mq-master-availability${compact?' mq-master-availability--compact':''}`} aria-live="polite">
  <p className="mq-master-availability__mode">{availabilityPending?copy('pendingLocation'):online?copy('requestedOn'):copy('requestedOff')}</p>
  <p>{connected?copy('connectionOn'):copy('connectionOff')}</p>
  {!connected&&<p className="mq-master-muted">{copy('connectionNote')}</p>}
  {geoDenied&&<p role="alert">{copy('geoDenied')}</p>}
  <Button className="mq-master-action" variant={online||availabilityPending?'secondary':'primary'} disabled={!user} onClick={online||availabilityPending?goOffline:goOnline}>{availabilityPending?copy('cancel'):online?copy('goOffline'):copy('goOnline')}</Button>
 </section>;
}
