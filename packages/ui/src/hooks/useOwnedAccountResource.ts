'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
export type AccountApi=(path:string,options?:RequestInit)=>Promise<any>;
interface State<T>{owner:string|null;data:T|null;loading:boolean;busy:boolean;fresh:boolean;error:string;generation:number;action:string|null}
const empty=<T,>(owner:string|null,generation=0):State<T>=>({owner,data:null,loading:!!owner,busy:false,fresh:false,error:'',generation,action:null});
/** Owner-scoped reads and guarded writes. No cache, authentication or business mutation on mount. */
export function useOwnedAccountResource<T>({ownerId,path,api}:{ownerId:string|null;path:string;api:AccountApi}){
 const [state,setState]=useState<State<T>>(()=>empty(ownerId));
 const ownership=useMemo(()=>({ownerId,path}),[ownerId,path]);
 const current=useRef(ownership),generation=useRef(0),mounted=useRef(false),busy=useRef(false),fresh=useRef(false);
 useLayoutEffect(()=>{current.current=ownership;mounted.current=true;generation.current++;busy.current=false;fresh.current=false;setState(empty(ownerId,generation.current));return()=>{mounted.current=false;generation.current++;fresh.current=false;};},[ownership,ownerId]);
 const owned=()=>!!ownerId&&mounted.current&&current.current===ownership;
 const retry=useCallback(async()=>{
  if(!ownerId||!mounted.current||current.current!==ownership||busy.current)return;
  const request=++generation.current;fresh.current=false;
  const valid=()=>mounted.current&&current.current===ownership&&generation.current===request;
  setState(previous=>({...previous,loading:true,fresh:false,error:'',generation:request}));
  try{const data=await api(path);if(!valid())return;fresh.current=true;setState({owner:ownerId,data,loading:false,busy:false,fresh:true,error:'',generation:request,action:null});}
  catch(error){if(!valid())return;setState(previous=>({...previous,loading:false,fresh:false,error:error instanceof Error?error.message:'Account read failed'}));}
 },[ownerId,ownership,path,api]);
 useEffect(()=>{void retry();},[retry]);
 const visible=state.owner===ownerId?state:empty<T>(ownerId);
 const capturedGeneration=visible.generation;
 const valid=()=>owned()&&generation.current===capturedGeneration&&fresh.current;
 function replaceData(data:T){if(valid())setState(previous=>({...previous,data}));}
 async function mutate(target:string,options:RequestInit,onSuccess?:(value:any)=>void){
  if(!valid()||busy.current)return;
  busy.current=true;setState(previous=>({...previous,busy:true,error:'',action:options.method??null}));
  const stillValid=()=>owned()&&generation.current===capturedGeneration;
  try{const result=await api(target,options);if(stillValid())onSuccess?.(result);}
  catch(error){if(stillValid())setState(previous=>({...previous,error:error instanceof Error?error.message:'Account update failed'}));}
  finally{if(stillValid()){busy.current=false;setState(previous=>({...previous,busy:false,action:null}));}}
 }
 return {...visible,retry,mutate,replaceData};
}
