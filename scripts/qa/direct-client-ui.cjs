// UI/API-contract checks with explicit fixtures; not an end-to-end backend test.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5173';
const output=process.env.QA_SCREENSHOTS_DIR;
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  for(const language of ['ru','kk','en'])for(const width of (process.env.QA_WIDTHS?process.env.QA_WIDTHS.split(',').map(Number):[360,390,430])) {
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   await context.addCookies([{name:'mq_locale',value:language,url:base}]);
   await context.addInitScript(language=>{localStorage.setItem('mq.locale',language);localStorage.setItem('token','fixture-only');localStorage.setItem('user',JSON.stringify({id:'client-1',name:'Client',phone:'+77000000000',role:'CLIENT'}));},language);
   let order={id:'order-1',status:'AWAITING_PRICE_CONFIRM',commercialMode:'DIRECT_PAYMENT',lifecycleVersion:2,quoteVersion:3,consentedVersion:null,quoteTotal:14000,workPrice:8000,materialsPrice:3500,calloutPrice:2500,serviceFee:0,description:'Replace pipe',address:'Astana',workComment:'Replace pipe',master:{id:'master-1',name:'Azat',phone:'+77000000001',rating:4.9,reviewCount:126},departedAt:'2026-10-12T00:00:00Z',updatedAt:'2026-10-12T00:01:00Z',review:null};
   const mutations=[];let failRead=false;
   await context.route('**/api/v1/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(failRead&&path.endsWith('/orders/order-1'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Refresh unavailable'})});
    let body=path.endsWith('/config/public')?{commercialMode:'DIRECT_PAYMENT',paymentsEnabled:false,leadCreditsEnabled:false,payoutsEnabled:false}:path.endsWith('/orders/order-1')?order:path.endsWith('/users/me')?{id:'client-1',name:'Client',role:'CLIENT',language}:[];
    if(route.request().method()==='POST') {
     const payload=route.request().postDataJSON();mutations.push({path,payload});
     if(path.endsWith('/confirm-price')) {assert.equal(payload.quoteVersion,3);await new Promise(resolve=>setTimeout(resolve,100));order={...order,status:'PRICE_APPROVED',consentedVersion:3};body=order;}
     if(path.endsWith('/cancel')) {return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Cancellation preview changed'})});}
    }
    if(path.endsWith('/cancellation-preview'))body={amount:2500,expectedUpdatedAt:order.updatedAt};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   });
   const page=await context.newPage();const exceptions=[];page.on('pageerror',error=>exceptions.push(error.message));
   await page.goto(`${base}/order/order-1`);
   const approve=page.getByRole('button',{name:language==='ru'?/Согласовать ·/:language==='kk'?/Келісу ·/:/Approve ·/});
   await approve.waitFor();await approve.dblclick();
   await page.getByRole('heading',{level:1,name:language==='ru'?'Стоимость согласована':language==='kk'?'Құны келісілді':'Price approved',exact:true}).waitFor();
   assert.equal(mutations.length,1,'Double click must issue only one mutation');
   assert.equal(await page.locator('nav').count(),0,'Order controls must not be covered by tabs');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
   assert.equal(await page.locator('[data-approved-notice]').isVisible(),width>=768,'Consent-change notice uses desktop layout only');
   assert.equal(await page.evaluate(()=>document.documentElement.lang),language);
   assert.equal(await page.locator('img').evaluateAll(images=>images.filter(image=>new URL(image.src).pathname.startsWith('/mq/')).some(image=>!image.complete||image.naturalWidth===0)),false,'Real SVG assets load');
   if(output){await fs.mkdir(output,{recursive:true});await page.screenshot({path:`${output}/client-approved-${language}-${width}.png`,fullPage:true});}
   const help=page.getByRole('button',{name:language==='ru'?'Помощь с заказом':language==='kk'?'Тапсырыс бойынша көмек':'Order help',exact:true}).filter({visible:true});
   if(language==='ru'&&width===360){
    failRead=true;await context.setOffline(true);await context.setOffline(false);
    await page.getByRole('alert').filter({hasText:'Refresh unavailable'}).waitFor();
    await help.first().click();assert.equal(await page.getByRole('button',{name:'Отменить заказ',exact:true}).isDisabled(),true,'Failed reconciliation must block mutations');
    await page.keyboard.press('Escape');failRead=false;
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.getByRole('alert').filter({hasText:'Refresh unavailable'}).waitFor({state:'hidden'});
   }
   await help.first().click();
   await page.getByRole('button',{name:language==='ru'?'Отменить заказ':language==='kk'?'Тапсырысты тоқтату':'Cancel order',exact:true}).click();
   const dialog=page.getByRole('dialog');await dialog.waitFor();
   await dialog.getByRole('button',{name:language==='ru'?'Подтвердить отмену':language==='kk'?'Тоқтатуды растау':'Confirm cancellation',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'Cancellation preview changed'}).waitFor();
   assert.equal(await dialog.count(),1,'A rejected cancellation must remain open');
   assert.equal(mutations.at(-1).payload.expectedAmount,2500);
   assert.equal(mutations.at(-1).payload.expectedUpdatedAt,order.updatedAt);
   await page.keyboard.press('Escape');
   const back=page.getByRole('button',{name:width>=768?(language==='ru'?'Мои заказы':language==='kk'?'Менің тапсырыстарым':'My orders'):(language==='ru'?'Назад':language==='kk'?'Артқа':'Back'),exact:true}).filter({visible:true});
   const previous=mutations.length;await back.click();await page.waitForURL('**/orders');assert.equal(mutations.length,previous,'Back must not mutate the order');
   assert.deepEqual(exceptions,[]);await context.close();console.log(`PASS ${language} ${width}: quote, duplicate click, cancellation conflict, back, assets, overflow`);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
