'use client';
import {createContext,useContext,useEffect,type ReactNode} from 'react';
import {api} from './api';
import {parseMetrics,type DashboardMetrics} from './metrics';
import {useAuth} from './auth';
import {useOperatorRead} from './useOperatorRead';
const POLL_INTERVAL_MS=30_000;
interface OperatorMetricsCtx {metrics:DashboardMetrics|null;loading:boolean;error:string|null;fresh:boolean;refetch:()=>void}
const Ctx=createContext<OperatorMetricsCtx>({metrics:null,loading:true,error:null,fresh:false,refetch:()=>{}});
async function readMetrics(path:string,signal:AbortSignal){return parseMetrics(await api(path,{signal}));}
export function OperatorMetricsProvider({children}:{children:ReactNode}) {
  const {user}=useAuth();
  const ownerId=user?.role==='OPERATOR'?user.id:null;
  const read=useOperatorRead({ownerId,path:'/admin/metrics',read:readMetrics});
  useEffect(()=>{if(!ownerId)return;const interval=setInterval(()=>{if(!document.hidden)void read.retry();},POLL_INTERVAL_MS);return()=>clearInterval(interval);},[ownerId,read.retry]);
  return <Ctx.Provider value={{metrics:read.data,loading:read.loading,error:read.error||null,fresh:read.fresh,refetch:read.retry}}>{children}</Ctx.Provider>;
}
export const useOperatorMetrics=()=>useContext(Ctx);
