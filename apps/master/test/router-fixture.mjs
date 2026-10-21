import React from 'react';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
import {PathnameContext,SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js';

// Mirrors the URL contexts supplied by Next, including native history traversal.
export function RouterFixture({children,navigations=[]}) {
  const [href,setHref]=React.useState(()=>window.location.href);
  React.useEffect(()=>{
    const update=()=>setHref(window.location.href);
    window.addEventListener('popstate',update);
    return()=>window.removeEventListener('popstate',update);
  },[]);
  const router=React.useMemo(()=>{
    const navigate=(method,url,options)=>{
      navigations.push({method,url,options});
      window.history[method==='push'?'pushState':'replaceState']({},'',url);
      setHref(window.location.href);
    };
    return {push:(url,options)=>navigate('push',url,options),replace:(url,options)=>navigate('replace',url,options),prefetch(){},refresh(){},back:()=>window.history.back(),forward:()=>window.history.forward()};
  },[navigations]);
  const url=new URL(href);
  return React.createElement(AppRouterContext.Provider,{value:router},
    React.createElement(PathnameContext.Provider,{value:url.pathname},
      React.createElement(SearchParamsContext.Provider,{value:url.searchParams},children)));
}

export async function traverseHistory(direction) {
  await React.act(async()=>{
    await new Promise((resolve,reject)=>{
      const onPop=()=>{clearTimeout(timeout);resolve();};
      const timeout=setTimeout(()=>{window.removeEventListener('popstate',onPop);reject(new Error('Expected a history traversal'));},2000);
      window.addEventListener('popstate',onPop,{once:true});
      window.history[direction]();
    });
  });
}
