'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
export function useOrderState<T>({id,read,subscribe}:{id:string;read:(id:string)=>Promise<T>;subscribe?:(refresh:()=>void)=>()=>void}) {
  const [order,setOrder]=useState<T|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[online,setOnline]=useState(true),[busy,setBusy]=useState(false),[fresh,setFresh]=useState(false);
  const generation=useRef(0),locked=useRef(false),mounted=useRef(false),activeId=useRef(id);
  activeId.current=id;
  const load=useCallback(async()=>{
    if(activeId.current!==id)return;
    setFresh(false);
    const request=++generation.current;
    try {const result=await read(id);if(mounted.current&&generation.current===request){setOrder(result);setError('');setFresh(true);}}
    catch(e){if(mounted.current&&generation.current===request)setError((e as Error).message);}
    finally{if(mounted.current&&generation.current===request)setLoading(false);}
  },[id,read]);
  useEffect(()=>{
    mounted.current=true;setOrder(null);setError('');setLoading(true);setOnline(navigator.onLine);void load();
    const refresh=()=>{if(navigator.onLine)void load();};
    const network=()=>{setOnline(navigator.onLine);refresh();};
    const foreground=()=>{if(document.visibilityState==='visible')refresh();};
    const unsubscribe=subscribe?.(refresh);
    window.addEventListener('online',network);window.addEventListener('offline',network);document.addEventListener('visibilitychange',foreground);
    return()=>{mounted.current=false;++generation.current;unsubscribe?.();window.removeEventListener('online',network);window.removeEventListener('offline',network);document.removeEventListener('visibilitychange',foreground);};
  },[id,load,subscribe]);
  const mutate=async(action:()=>Promise<unknown>)=>{
    if(locked.current||!fresh||!online||!navigator.onLine)return false;
    locked.current=true;setBusy(true);setError('');
    let failure='';
    try {await action();}catch(e){failure=(e as Error).message;}
    if(activeId.current===id){await load();if(failure&&mounted.current)setError(failure);}
    locked.current=false;if(mounted.current)setBusy(false);
    return !failure&&activeId.current===id;
  };
  return {order,loading,error,online,fresh,busy,load,mutate};
}
