'use client';
import {Button,useLocale} from '@masterqala/ui';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useAuth} from '@/lib/auth';
import {useMasterPresence} from '@/lib/masterPresence';
import {useMasterDashboardData} from '@/lib/useMasterDashboardData';
import {masterSurfaceText} from '@/lib/masterSurfaceCopy';
import {MasterAvailabilityControl} from '@/components/MasterAvailabilityControl';
import {ActiveOrderView} from '@/components/ActiveOrderView';
import {PlannedFeedView} from '@/components/PlannedFeedView';

type Tab='urgent'|'planned';
export default function WorkDashboardPage(){
 const {language}=useLocale(),{user}=useAuth(),{offer}=useMasterPresence();
 const copy=(key:Parameters<typeof masterSurfaceText>[1])=>masterSurfaceText(language,key);
 const sources=useMasterDashboardData({ownerId:user?.id??null});
 const application=sources.application.data,activeOrder=sources.active.data,stats=sources.stats.data;
 const [tab,setTab]=useState<Tab>('urgent');
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('tab')==='planned')setTab('planned');},[]);
 const warning=(error:string,retained:boolean,retry:()=>Promise<void>)=>error?<div role="alert" className="mq-master-read-warning">{retained&&<p>{copy('stale')}</p>}<p>{error}</p><Button variant="secondary" onClick={()=>void retry()}>{copy('retry')}</Button></div>:null;
 const title=<h1>{copy('work')}</h1>;
 if(sources.application.loading&&!application)return <div className="mq-master-dashboard">{title}<p role="status">{copy('loading')}</p></div>;
 if(sources.application.error&&!application)return <div className="mq-master-dashboard">{title}{warning(sources.application.error,false,sources.application.retry)}</div>;
 if(!application||application.status!=='ACTIVE')return <div className="mq-master-dashboard">{title}{warning(sources.application.error,!!application,sources.application.retry)}<section className="mq-master-card"><h2>{application?copy(application.status):copy('noApplication')}</h2>{application?.fullName&&<p>{application.fullName}</p>}{application?.status==='REJECTED'&&application.rejectionReason&&<p>{copy('decision')}: {application.rejectionReason}</p>}{application?.status==='NEEDS_INFO'&&application.latestDecisionComment&&<p>{copy('additional')}: {application.latestDecisionComment}</p>}<Link className="mq-master-link-action" href="/become-master">{copy(application?'openApplication':'submitApplication')}</Link></section></div>;
 const mobileAvailability=<div className="mq-master-dashboard__availability"><MasterAvailabilityControl/></div>;
 const warnings=<>{warning(sources.application.error,true,sources.application.retry)}{warning(sources.active.error,!!activeOrder,sources.active.retry)}{warning(sources.stats.error,!!stats,sources.stats.retry)}</>;
 if(sources.active.loading&&!activeOrder)return <div className="mq-master-dashboard">{title}{warnings}<p role="status">{copy('loading')}</p></div>;
 if(sources.active.error&&!activeOrder)return <div className="mq-master-dashboard">{title}{warnings}</div>;
 if(activeOrder&&(activeOrder.lifecycleVersion??1)<2)return <div className="h-full">{warnings}<ActiveOrderView order={activeOrder} onChanged={sources.active.retry}/></div>;
 if(activeOrder)return <div className="mq-master-dashboard">{title}{warnings}{mobileAvailability}<section className="mq-master-card"><h2>{copy('currentOrder')}</h2><dl><div><dt>{copy('task')}</dt><dd>{activeOrder.description||copy('unavailable')}</dd></div><div><dt>{copy('address')}</dt><dd>{activeOrder.address||copy('unavailable')}</dd></div></dl><Link className="mq-master-link-action" href={`/order/${encodeURIComponent(activeOrder.id)}`}>{copy('openOrder')}</Link></section></div>;
 const specialties=application.categories.map(item=>item?.category?.name).filter(name=>typeof name==='string'&&!!name.trim());
 return <div className="mq-master-dashboard">{title}{warnings}{mobileAvailability}<div className="mq-master-dashboard__tabs" role="group" aria-label={copy('work')}><button type="button" aria-pressed={tab==='urgent'} onClick={()=>setTab('urgent')}>{copy('urgent')}</button><button type="button" aria-pressed={tab==='planned'} onClick={()=>setTab('planned')}>{copy('planned')}</button></div>{tab==='planned'?<PlannedFeedView/>:<div className="mq-master-dashboard__grid"><div className="mq-master-dashboard__main"><section className="mq-master-card"><h2>{application.fullName}</h2><dl><div><dt>{copy('specialty')}</dt><dd>{specialties.length?specialties.join(', '):copy('unavailable')}</dd></div><div><dt>{copy('district')}</dt><dd>{application.district||copy('unavailable')}</dd></div></dl></section>{offer?<section className="mq-master-card"><h2>{copy('actualOffer')}</h2><p>{offer.category}</p><p>{offer.description}</p>{offer.district&&<p>{offer.district}</p>}{Number.isFinite(offer.distanceKm)&&offer.distanceKm>=0&&<p>{copy('distance')}: {new Intl.NumberFormat(language,{maximumFractionDigits:1}).format(offer.distanceKm)} {copy('km')}</p>}<p className="mq-master-muted">{copy('offerNote')}</p></section>:<section className="mq-master-card mq-master-empty"><h2>{copy('noOffer')}</h2><p>{copy('noOfferNote')}</p></section>}</div><aside className="mq-master-dashboard__aside"><section className="mq-master-card"><h2>{copy('profile')}</h2><dl><div><dt>{copy('completed')}</dt><dd>{stats?.completedCount??'—'}</dd></div><div><dt>{copy('rating')}</dt><dd data-master-rating>{stats?.rating!=null?stats.rating.toFixed(1):'—'}</dd></div><div><dt>{copy('reviews')}</dt><dd>{stats?.reviewCount??'—'}</dd></div></dl><Link href="/become-master">{copy('openApplication')}</Link></section></aside></div>}</div>;
}
