// Fixture Socket.IO + REST exercise delivery/reconciliation races, not database dispatch.
const assert=require('node:assert/strict');
const http=require('node:http');
const {Server}=require('../../apps/api/node_modules/socket.io');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const httpServer=http.createServer(),io=new Server(httpServer,{cors:{origin:true}});
 await new Promise(resolve=>httpServer.listen(3000,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(()=>{localStorage.setItem('token','fixture-only');localStorage.setItem('user',JSON.stringify({id:'master-1',name:'Azat',phone:'+77000000001',role:'CLIENT'}));});
 const offer={offerId:'offer-1',orderId:'order-1',directPayment:true,category:'Plumbing',description:'Pipe',distanceKm:1,deadline:new Date(Date.now()+30000).toISOString()};
 let pending=null,holdNext=false,held,release;
 const heldPromise=new Promise(resolve=>{held=resolve;});
 const releasePromise=new Promise(resolve=>{release=resolve;});
 const order={id:'order-1',status:'ACCEPTED',lifecycleVersion:2,commercialMode:'DIRECT_PAYMENT',quoteVersion:0,consentedVersion:null,workPrice:null,materialsPrice:0,calloutPrice:0,quoteTotal:null,description:'Pipe',address:'Astana',client:{name:'Client',phone:'+77000000000'}};
 await ctx.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let body=path.endsWith('/config/public')?{commercialMode:'DIRECT_PAYMENT',paymentsEnabled:false,leadCreditsEnabled:false,payoutsEnabled:false}:path.endsWith('/orders/order-1')||path.endsWith('/accept')?order:[];
  if(path.endsWith('/master/pending-offer')){body={offer:pending};if(holdNext){holdNext=false;held();await releasePromise;}}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await ctx.newPage();await page.goto(`${process.env.QA_BASE_URL||'http://127.0.0.1:4300'}/order/order-1`);
 // Wait for the actual client Socket.IO subscription before emitting.
 for(let attempt=0;attempt<100&&io.sockets.sockets.size===0;attempt++)await new Promise(resolve=>setTimeout(resolve,50));
 assert.equal(io.sockets.sockets.size,1);
 io.emit('offer:new',offer);await page.getByRole('dialog',{name:'Новая заявка'}).waitFor();
 pending=offer;holdNext=true;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await heldPromise;
 await page.getByRole('button',{name:'Принять заявку',exact:true}).click();await page.getByRole('dialog',{name:'Новая заявка'}).waitFor({state:'hidden'});
 const response=page.waitForResponse(r=>r.url().endsWith('/master/pending-offer'));release();await response;await page.waitForTimeout(100);
 assert.equal(await page.getByRole('dialog',{name:'Новая заявка'}).count(),0,'A late restore must not reinsert an accepted offer');
 io.emit('offer:new',{...offer,offerId:'offer-2',orderId:'order-2'});await page.getByRole('dialog',{name:'Новая заявка'}).waitFor();
 const decline=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/orders/order-2/decline'));
 await page.getByRole('button',{name:'Пропустить',exact:true}).click();await decline;await page.getByRole('dialog',{name:'Новая заявка'}).waitFor({state:'hidden'});
 console.log('PASS persisted offer restore race and real decline UI endpoint');
 await ctx.close();
 }finally{await browser.close();await new Promise(resolve=>io.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
