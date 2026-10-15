/** Destructive cleanup is allowed only in the dedicated disposable queue-test database. */
export function assertIsolatedQueueDatabase(databaseUrl:string|undefined,optIn:string|undefined,nodeEnv:string|undefined):void {
  if(optIn!=='1'||nodeEnv!=='test'||!databaseUrl)throw new Error('Isolated queue-test opt-in and NODE_ENV=test are required');
  let url:URL;
  try{url=new URL(databaseUrl);}catch{throw new Error('Invalid isolated queue-test database URL');}
  if(!['postgresql:','postgres:'].includes(url.protocol)||!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='5434'||url.pathname!=='/masterqala_urgent_queue_ci'||url.search||url.hash) {
    throw new Error('Queue tests require the dedicated loopback5434/masterqala_urgent_queue_ci database');
  }
}
