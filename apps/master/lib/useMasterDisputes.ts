'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {parseDisputeSummaries,type DisputeSummary} from '@masterqala/ui';
import {api} from './api';
/** Actual participant list; no cache or writes. A detail route has its own resolver lifetime. */
export function useMasterDisputes(ownerId:string|null,scope='list') {
  const lifetime=useMemo(()=>({ownerId,scope}),[ownerId,scope]);
  const current=useRef(lifetime),mounted=useRef(false),generation=useRef(0),reading=useRef(false);
  const blank=()=>({lifetime,disputes:[] as DisputeSummary[],loading:!!ownerId,error:'',fresh:false});
  const [state,setState]=useState(blank);
  useLayoutEffect(()=>{current.current=lifetime;mounted.current=true;generation.current++;reading.current=false;setState(blank());return()=>{mounted.current=false;generation.current++;reading.current=false;};},[lifetime]);
  const retry=useCallback(async()=>{
    if(!ownerId||!mounted.current||current.current!==lifetime||reading.current)return;
    reading.current=true;const request=++generation.current;
    const valid=()=>mounted.current&&current.current===lifetime&&generation.current===request;
    setState(previous=>({...previous,loading:true,error:'',fresh:false}));
    try {const disputes=parseDisputeSummaries(await api('/disputes/mine'));if(valid())setState({lifetime,disputes,loading:false,error:'',fresh:true});}
    catch(error){if(valid())setState(previous=>({...previous,loading:false,fresh:false,error:error instanceof Error?error.message:'Dispute read failed'}));}
    finally{if(valid())reading.current=false;}
  },[ownerId,lifetime]);
  useEffect(()=>{void retry();},[retry]);
  return {...(state.lifetime===lifetime?state:blank()),retry};
}
