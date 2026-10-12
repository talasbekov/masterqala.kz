// UI/API fixtures only; backend end-to-end checks run separately.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:4300';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});try{
for(const language of ['ru','kk','en'])for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 await ctx.addCookies([{name:'mq_locale',value:language,url:base}]);
 await ctx.addInitScript(language=>{localStorage.setItem('mq.locale',language);localStorage.setItem('token','fixture-only');localStorage.setItem('user',JSON.stringify({id:'master-1',name:'Azat',phone:'+77000000001',role:'CLIENT'}));},language);
 let order={id:'order-1',status:'INSPECTION',commercialMode:'DIRECT_PAYMENT',lifecycleVersion:2,quoteVersion:0,consentedVersion:null,quoteTotal:null,workPrice:null,materialsPrice:0,calloutPrice:0,description:'Replace pipe',address:'Astana',workComment:null,client:{name:'Client',phone:'+77000000000'},departedAt:'2026-10-12T00:00:00Z',updatedAt:'2026-10-12T00:01:00Z'};
 let reject=true;const mutations=[];
 await ctx.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let body=path.endsWith('/config/public')?{commercialMode:'DIRECT_PAYMENT',paymentsEnabled:false,leadCreditsEnabled:false,payoutsEnabled:false}:path.endsWith('/orders/order-1')?order:[];
  if(route.request().method()==='POST'){
   const payload=route.request().postDataJSON();mutations.push({path,payload});
   if(path.endsWith('/propose-price')){
    assert.equal(payload.amount,8000);assert.equal(payload.materialsPrice,3500);assert.equal(payload.calloutPrice,2500);assert.equal(payload.expectedQuoteVersion,0);
    if(reject){reject=false;return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Quote changed'})});}
    order={...order,status:'AWAITING_PRICE_CONFIRM',quoteVersion:1,quoteTotal:14000,workPrice:8000,materialsPrice:3500,calloutPrice:2500};body=order;
   }
   if(path.endsWith('/start-work')){assert.equal(payload.quoteVersion,1);order={...order,status:'IN_PROGRESS'};body=order;}
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/order/order-1`);
 const labels=language==='ru'?['Работа','Материалы','Выезд']:language==='kk'?['Жұмыс','Материалдар','Келу']:['Work','Materials','Callout'];
 for(let i=0;i<3;i++)await page.getByRole('spinbutton',{name:labels[i],exact:true}).fill(['8000','3500','2500'][i]);
 const send=page.getByRole('button',{name:language==='ru'?/Отправить ·/:language==='kk'?/Жіберу ·/:/Send ·/}).filter({visible:true});
 await send.click();await page.getByRole('alert').filter({hasText:'Quote changed'}).waitFor();assert.equal(await page.getByRole('spinbutton',{name:labels[0],exact:true}).inputValue(),'8000');
 await send.click();await page.getByRole('heading',{name:language==='ru'?'Ждём согласования':language==='kk'?'Келісімді күтудеміз':'Waiting for approval',exact:true}).waitFor();
 order={...order,status:'PRICE_APPROVED',consentedVersion:1};await page.reload();
 const start=page.getByRole('button',{name:language==='ru'?'Начать работу':language==='kk'?'Жұмысты бастау':'Start work',exact:true}).filter({visible:true});await start.waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(process.env.QA_SCREENSHOTS_DIR){await fs.mkdir(process.env.QA_SCREENSHOTS_DIR,{recursive:true});await page.screenshot({path:`${process.env.QA_SCREENSHOTS_DIR}/master-approved-${language}-${width}.png`,fullPage:true});}
 await start.click();await page.getByRole('heading',{name:language==='ru'?'Работа выполняется':language==='kk'?'Жұмыс орындалып жатыр':'Work in progress',exact:true}).waitFor();assert.equal(mutations.filter(m=>m.path.endsWith('/start-work')).length,1);assert.deepEqual(errors,[]);
 await ctx.close();console.log(`PASS master ${language} ${width}: quote conflict, preserved draft, consent, explicit start`);
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
