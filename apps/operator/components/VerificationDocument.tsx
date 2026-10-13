'use client';
import {useEffect,useRef,useState} from 'react';
import {Button,Dialog,useLocale} from '@masterqala/ui';
import {apiBlob} from '../lib/api';
import {verificationText} from '../lib/operator-verification-copy';
const allowed=new Set(['image/jpeg','image/png','application/pdf']);
const mime=(value:string|null)=>value?.split(';')[0].trim().toLowerCase()??'';
export function VerificationDocument({path,title,scope,isCurrent,onClose}:{path:string;title:string;scope:string;isCurrent:()=>boolean;onClose:()=>void}){
 const {language}=useLocale(),t=(key:Parameters<typeof verificationText>[1])=>verificationText(language,key);
 const [attempt,setAttempt]=useState(0),attemptRef=useRef(attempt);attemptRef.current=attempt;
 const [state,setState]=useState({scope,attempt,status:'loading' as 'loading'|'error'|'ready',url:'',mime:''});
 const current=useRef({scope,isCurrent});current.current={scope,isCurrent};const mounted=useRef(false);
 useEffect(()=>{mounted.current=true;const controller=new AbortController();let url='';const valid=()=>mounted.current&&current.current.scope===scope&&attemptRef.current===attempt&&!controller.signal.aborted&&current.current.isCurrent();setState({scope,attempt,status:'loading',url:'',mime:''});
  if(valid())void apiBlob(path,{signal:controller.signal}).then(({blob,contentType})=>{if(!valid())return;const contentMime=mime(contentType),blobMime=mime(blob.type);if(!allowed.has(contentMime)||(blobMime&&blobMime!==contentMime))throw new Error('Unsupported document content');url=URL.createObjectURL(blob);if(valid())setState({scope,attempt,status:'ready',url,mime:contentMime});else{URL.revokeObjectURL(url);url='';}}).catch(()=>{if(valid())setState({scope,attempt,status:'error',url:'',mime:''});});
  return()=>{mounted.current=false;controller.abort();if(url)URL.revokeObjectURL(url);};
 },[scope,path,attempt]);
 const visible=state.scope===scope&&state.attempt===attempt&&isCurrent()?state:null;
 function retry(){if(!mounted.current||current.current.scope!==scope||attemptRef.current!==attempt||!current.current.isCurrent())return;attemptRef.current++;setAttempt(attemptRef.current);}
 return <Dialog open title={title} onClose={onClose}><div className="max-h-[80dvh] overflow-y-auto"><h2 className="text-xl font-semibold">{title}</h2><p className="my-4 text-sm text-ink-soft">{t('viewNote')}</p>{visible?.status==='loading'&&<p role="status">{t('documentLoading')}</p>}{visible?.status==='error'&&<div data-document-error role="alert"><p>{t('documentError')}</p><Button data-document-retry variant="secondary" onClick={retry}>{t('retry')}</Button></div>}{visible?.status==='ready'&&<>{visible.mime==='application/pdf'?<object data-verification-pdf data={visible.url} type="application/pdf" aria-label={title} className="h-[50dvh] w-full"><p>{t('pdfFallback')}</p></object>:<img data-verification-image src={visible.url} alt={title} className="max-h-[65dvh] max-w-full"/>}<a data-document-open href={visible.url} target="_blank" rel="noopener noreferrer" className="my-4 inline-flex min-h-12 items-center font-semibold underline">{t('openFile')}</a></>}<Button data-document-close variant="secondary" onClick={onClose}>{t('back')}</Button></div></Dialog>;
}
