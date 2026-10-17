'use client';
import {masterCategoryName} from '@/lib/category-name';
import {Button,useLocale} from '@masterqala/ui';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {useAuth} from '@/lib/auth';
import {useMasterPresence} from '@/lib/masterPresence';
import {useMasterDashboardData} from '@/lib/useMasterDashboardData';
import {masterSurfaceText} from '@/lib/masterSurfaceCopy';
import {masterDesignCopy} from '@/lib/masterDesignCopy';
import {MasterAvailabilityControl} from '@/components/MasterAvailabilityControl';
import {ActiveOrderView} from '@/components/ActiveOrderView';
import {PlannedFeedView} from '@/components/PlannedFeedView';

type Tab='urgent'|'planned';
export default function WorkDashboardPage(){
 const {language}=useLocale(),{user}=useAuth(),{offer}=useMasterPresence(),design=masterDesignCopy(language);
 const copy=(key:Parameters<typeof masterSurfaceText>[1])=>masterSurfaceText(language,key);
 const sources=useMasterDashboardData({ownerId:user?.id??null});
 const application=sources.application.data,activeOrder=sources.active.data,stats=sources.stats.data;
 const [tab,setTab]=useState<Tab>('urgent');
 const router=useRouter(),search=useSearchParams(),query=search?.toString();
 useEffect(()=>{setTab(new URLSearchParams(query??window.location.search).get('tab')==='planned'?'planned':'urgent');},[query]);
 const selectTab=(value:Tab)=>{setTab(value);router.push(value==='planned'?'/?tab=planned':'/');};
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
 const specialties=application.categories.map(item=>item?.category?masterCategoryName(item.category,language):'').filter(name=>typeof name==='string'&&!!name.trim());
 return <div className="mq-master-dashboard mq-master-overview"><h1>{design.greeting}{application.fullName?`, ${application.fullName}`:''}</h1><p className="mq-master-overview__intro">{design.intro}</p>{warnings}<div className="mq-master-dashboard__grid"><div className="mq-master-dashboard__main">
 {tab==='planned'?<><div className="mq-master-dashboard__tabs" role="group" aria-label={copy('work')}><button type="button" aria-pressed={false} onClick={()=>selectTab('urgent')}>{copy('urgent')}</button><button type="button" aria-pressed onClick={()=>selectTab('planned')}>{copy('planned')}</button></div><PlannedFeedView/></>:<>
  <div className="mq-master-metrics"><section className="mq-master-card"><p>{copy('completed')}</p><strong>{stats?.completedCount??'—'}</strong><p>{copy('completed')}</p></section><section className="mq-master-card"><p>{copy('rating')}</p><strong data-master-rating>{stats?.rating!=null?stats.rating.toFixed(1):'—'}</strong><p>{copy('reviews')}: {stats?.reviewCount??'—'}</p></section></div>
  {offer?<section className="mq-master-card"><h2>{copy('actualOffer')}</h2><span className="mq-master-status">{copy('urgent')}</span><h3>{offer.category}</h3><p>{offer.description}</p>{offer.district&&<p>{offer.district}</p>}{Number.isFinite(offer.distanceKm)&&offer.distanceKm>=0&&<p>{copy('distance')}: {new Intl.NumberFormat(language,{maximumFractionDigits:1}).format(offer.distanceKm)} {copy('km')}</p>}<p className="mq-master-muted">{copy('offerNote')}</p></section>:<section className="mq-master-card mq-master-empty"><h2>{copy('noOffer')}</h2><p>{copy('noOfferNote')}</p></section>}
  <section className="mq-master-card"><h2>{design.planned}</h2><p>{design.plannedNote}</p><button className="mq-master-secondary-action" data-open-planned type="button" onClick={()=>selectTab('planned')}>{design.planned}</button></section>
 </>}
 </div><aside className="mq-master-dashboard__aside"><section className="mq-master-card"><h2>{design.readiness}</h2>{mobileAvailability}<p>{specialties.length?specialties.join(', '):copy('unavailable')}</p><p>{application.district||copy('unavailable')}</p><Link className="mq-master-secondary-action" href="/become-master">{copy('openApplication')}</Link></section></aside></div></div>;
}