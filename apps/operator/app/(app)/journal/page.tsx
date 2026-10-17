'use client';
import {useRef,useState} from 'react';
import {Button,useLocale} from '@masterqala/ui';
import {useAuth} from '../../../lib/auth';
import {useOperatorRead} from '../../../lib/useOperatorRead';
import {readOperatorJournal} from '../../../lib/operator-read-data';
import {operatorAction,operatorDate,operatorTarget,operatorReadText,type OperatorReadKey} from '../../../lib/operator-read-copy';
function OwnedJournal({ownerId}:{ownerId:string|null}) {
 const {language}=useLocale(),t=(key:OperatorReadKey)=>operatorReadText(language,key);
 const [page,setPage]=useState(1),pageRef=useRef(page);pageRef.current=page;
 const read=useOperatorRead({ownerId,path:`/admin/journal?page=${page}`,read:readOperatorJournal});
 const current=useRef(read);current.current=read;
 const last=read.data?Math.max(1,Math.ceil(read.data.total/read.data.pageSize)):1;
 function changePage(next:number){if(pageRef.current!==page||!read.isVerifiedCurrent()||!current.current.fresh||current.current.loading||next<1||next>last)return;pageRef.current=next;setPage(next);}
 return <section className="flex min-w-0 flex-col gap-6 px-6 py-6 text-base leading-6 md:px-10 md:py-8"><header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold md:text-[32px]">{t('journal')}</h1><p className="mt-6 text-ink-soft">{t('journalNote')}</p></div><Button data-journal-retry variant="secondary" disabled={read.loading} onClick={()=>{void read.retry();}}>{t('refresh')}</Button></header>{read.loading&&<p role="status">{t('loading')}</p>}{read.error&&<p role="alert">{t('readError')}</p>}{read.data&&!read.fresh&&<p data-journal-stale role="status">{t('stale')}</p>}{read.fresh&&!read.loading&&read.data?.rows.length===0&&<p data-journal-empty>{t('emptyJournal')}</p>}{read.data&&read.data.rows.length>0&&<div className="min-w-0 overflow-x-auto rounded-2xl bg-surface"><table className="operator-journal-table w-full text-left text-sm"><thead className="text-xs text-ink-soft"><tr>{(['time','actor','action','target'] as const).map(key=><th key={key} scope="col" className="p-4 font-normal">{t(key)}</th>)}</tr></thead><tbody>{read.data.rows.map(row=><tr key={row.id}><td className="p-4">{operatorDate(language,row.createdAt)}</td><td className="break-words p-4">{row.actorType==='SYSTEM'?t('system'):row.actor?(row.actor.name??row.actor.phone):t('actorUnknown')}</td><td className="break-words whitespace-pre-wrap p-4">{operatorAction(language,row.action)}{row.comment?`: ${row.comment}`:''}</td><td className="break-words p-4">{operatorTarget(language,row.targetType)}: {row.targetId}</td></tr>)}</tbody></table></div>}<div className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface p-6"><Button data-journal-previous variant="secondary" disabled={!read.fresh||read.loading||page<=1} onClick={()=>changePage(Math.min(page-1,last))}>{t('previous')}</Button><span>{operatorReadText(language,'page',{page,n:read.data?.total??'—'})}</span><Button data-journal-next variant="secondary" disabled={!read.fresh||read.loading||page>=last} onClick={()=>changePage(page+1)}>{t('next')}</Button></div></section>;
}
export default function JournalPage(){const {user}=useAuth();const ownerId=user?.role==='OPERATOR'?user.id:null;return <OwnedJournal key={ownerId??'signed-out'} ownerId={ownerId}/>;}
