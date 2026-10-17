import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {LocaleProvider} from '@masterqala/ui';import {AboutPage,FaqPage,MasterPage,CategoryPage,HomePage,getMasterAppUrl,Footer} from '../.test-build/public-entry.js';
const render=async(Component,language,props={})=>renderToStaticMarkup(React.createElement(LocaleProvider,{initialLanguage:language},await Component(props)));
for(const language of ['ru','kk','en'])test(`${language} existing information and home views use truthful localized copy and configured destinations`,async()=>{
 const original=global.fetch;global.fetch=async()=>({ok:true,json:async()=>[{id:'one',slug:'plumbing',name:'Actual category'}]});process.env.APP_URL='https://client.example';delete process.env.MASTER_APP_URL;
 try{const about=await render(AboutPage,language),faq=await render(FaqPage,language),master=await render(MasterPage,language),home=await render(HomePage,language);
 assert.ok(about.includes(({ru:'О MasterQala',kk:'MasterQala туралы',en:'About MasterQala'})[language]));assert.ok(faq.includes(({ru:'До начала работ',kk:'Жұмыс басталғанға дейін',en:'Before work begins'})[language]));assert.ok(master.includes(({ru:'Заявка мастера',kk:'Шебер өтінімі',en:'Master application'})[language]));assert.ok(home.includes(({ru:'Опишите задачу',kk:'Мәселені сипаттаңыз',en:'Describe the task'})[language]));
 for(const html of [about,faq,master,home])assert.ok(!/7666|100%|15 минут|без комиссии|лид.?кредит|возвращаются|24\/7/.test(html));
 assert.ok(!master.includes('href="http://localhost:5173/become-master"'));assert.ok(!master.includes('href="https://client.example/become-master"'));assert.ok(home.includes('Actual category'));assert.ok(home.includes('href="https://client.example/"'));
 }finally{global.fetch=original;delete process.env.APP_URL}
});
test('master application uses only explicit valid master destination',async()=>{delete process.env.MASTER_APP_URL;assert.equal(getMasterAppUrl(),null);let html=await render(MasterPage,'en');assert.ok(!html.includes('/become-master"'));process.env.MASTER_APP_URL='https://master.example';html=await render(MasterPage,'en');assert.ok(html.includes('href="https://master.example/become-master"'));process.env.MASTER_APP_URL='javascript:alert(1)';assert.equal(getMasterAppUrl(),null);delete process.env.MASTER_APP_URL});
test('category 404 requires verified missing slug; HTTP and malformed reads stay errors',async()=>{const original=global.fetch;try{global.fetch=async()=>({ok:true,json:async()=>[]});await assert.rejects(CategoryPage({params:Promise.resolve({slug:'missing'})}),e=>e.digest?.includes('404'));global.fetch=async()=>({ok:false,status:503});await assert.rejects(CategoryPage({params:Promise.resolve({slug:'missing'})}),e=>!e.digest);global.fetch=async()=>({ok:true,json:async()=>({})});await assert.rejects(CategoryPage({params:Promise.resolve({slug:'missing'})}),e=>!e.digest)}finally{global.fetch=original}});
for(const language of ['ru','kk','en'])test(`${language} category keeps actual backend name and generic request guidance`,async()=>{const original=global.fetch;global.fetch=async()=>({ok:true,json:async()=>[{id:'one',slug:'plumbing',name:'Actual category with long actual name'}]});process.env.APP_URL='https://client.example';try{const html=await render(CategoryPage,language,{params:Promise.resolve({slug:'plumbing'})});assert.ok(html.includes('Actual category with long actual name'));assert.ok(html.includes(({ru:'Опишите задачу',kk:'Мәселені сипаттаңыз',en:'Describe the task'})[language]));assert.ok(html.includes('href="https://client.example/"'));assert.ok(!/инструменты|запчасти|known.*callout|стоимость выезда известна/.test(html))}finally{global.fetch=original;delete process.env.APP_URL}});

test('public planned and support actions lead to their matching client flows while find stays map-first',async()=>{
 const original=global.fetch;global.fetch=async()=>({ok:true,json:async()=>[]});process.env.APP_URL='https://client.example';
 try{
  const home=await render(HomePage,'en'),faq=await render(FaqPage,'en');
  const footer=renderToStaticMarkup(React.createElement(LocaleProvider,{initialLanguage:'en'},React.createElement(Footer,{phone:null,email:null,appUrl:'https://client.example'})));
  assert.match(footer,/<a[^>]+href="https:\/\/client\.example\/planned\/new"[^>]*>Plan the work/);
  assert.match(home,/<a[^>]+href="https:\/\/client\.example\/planned\/new"[^>]*>Plan the work/);
  assert.match(faq,/<a[^>]+href="https:\/\/client\.example\/support"[^>]*>Help with an order/);
  assert.match(home,/<a[^>]+href="https:\/\/client\.example\/"[^>]*>Find a master/);
 }finally{global.fetch=original;delete process.env.APP_URL}
});
