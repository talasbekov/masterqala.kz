'use client';
import Link from 'next/link';
import {useLocale} from '@masterqala/ui';
import {serviceCopy} from './copy';
import {designCopy} from './design-copy';
import './desktop-service.css';
export function DesktopServiceView({kind,authenticated,orderId}:{kind:'support'|'notifications';authenticated:boolean;orderId?:string}) {
 const {language,t}=useLocale(),copy=serviceCopy[language],design=designCopy[language],support=kind==='support';
 const orderHref=support&&orderId?`/order/${encodeURIComponent(orderId)}`:undefined;
 return <section className="desktop-service desktop-service-desktop" aria-labelledby="desktop-service-heading">
  <p className="desktop-service-status">{support?design.supportStatus:design.notificationStatus}</p>
  <header className="desktop-service-heading"><h1 id="desktop-service-heading">{support?copy.support:copy.notifications}</h1><p>{support?design.supportIntro:design.notificationIntro}</p></header>
  <div className="desktop-service-columns"><div className="desktop-service-stack">
   <section className="desktop-service-card" {...(!support?{'data-service-unavailable':true}:{})}><h2>{support?design.orderHeading:design.feedHeading}</h2><p>{support?design.orderBody:design.feedBody}</p></section>
   <nav className="desktop-service-actions"><Link className="desktop-service-action" href={orderHref??'/orders'}>{orderHref?t('orderNumber',{id:orderId!}):copy.orders}</Link><Link className="desktop-service-action" href={support?(authenticated?'/profile':'/login'):'/support'}>{support?(authenticated?copy.profile:copy.signIn):copy.support}</Link></nav>
  </div><aside className="desktop-service-stack">
   <section className="desktop-service-card" {...(support?{'data-service-unavailable':true}:{})}><h2>{support?design.contactHeading:design.checkHeading}</h2><p>{support?design.contactBody:design.checkBody}</p></section>
   <section className="desktop-service-card"><h2>{support?design.caseHeading:design.permissionsHeading}</h2><p>{support?design.caseBody:design.permissionsBody}</p></section>
  </aside></div>
 </section>;
}
