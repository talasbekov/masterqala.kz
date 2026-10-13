'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
/** Read-only owner/path lifetime. No cache or writes, synchronous duplicate guard. */
export function useOperatorRead<T>({ownerId,path,read}:{ownerId:string|null;path:string;read:(path:string,signal:AbortSignal)=>Promise<T>}) {
  const lifetime=useMemo(()=>({ownerId,path,read}),[ownerId,path,read]);
  const current=useRef(lifetime),mounted=useRef(false),generation=useRef(0),pending=useRef(false),controller=useRef<AbortController|null>(null);
  const blank=()=>({lifetime,data:null as T|null,loading:!!ownerId,fresh:false,error:'',readGeneration:generation.current});
  const [state,setState]=useState(blank);
  useLayoutEffect(()=>{current.current=lifetime;mounted.current=true;generation.current++;pending.current=false;setState(blank());return()=>{mounted.current=false;generation.current++;pending.current=false;controller.current?.abort();controller.current=null;};},[lifetime]);
  const retry=useCallback(async()=>{
    if(!ownerId||!mounted.current||current.current!==lifetime||pending.current)return;
    pending.current=true;const request=++generation.current;const abort=new AbortController();controller.current=abort;
    const valid=()=>mounted.current&&current.current===lifetime&&generation.current===request&&!abort.signal.aborted;
    setState(previous=>({...previous,loading:true,error:'',fresh:false,readGeneration:request}));
    try{const data=await read(path,abort.signal);if(valid())setState({lifetime,data,loading:false,fresh:true,error:'',readGeneration:request});}
    catch(error){if(valid())setState(previous=>({...previous,loading:false,fresh:false,error:error instanceof Error?error.message:'Read failed'}));}
    finally{if(valid()){pending.current=false;controller.current=null;}}
  },[ownerId,path,read,lifetime]);
  useEffect(()=>{void retry();},[retry]);
  const visible=state.lifetime===lifetime?state:blank();
  const isVerifiedCurrent=()=>!!ownerId&&mounted.current&&current.current===lifetime&&generation.current===visible.readGeneration&&visible.fresh&&!pending.current;
  return {...visible,retry,isVerifiedCurrent};
}
