import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {RouterFixture,traverseHistory} from './router-fixture.mjs';
const require=createRequire(new URL('../../../packages/ui/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://test.local/'});
Object.assign(globalThis,{window:dom.window,self:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const {LocaleProvider}=await import('@masterqala/ui');
const {AuthProvider,MasterWorkspace}=await import('../.test-build/test/safety-entry.js');

async function mount(href,language='en') {
  window.history.replaceState({},'',href);
  localStorage.clear();localStorage.setItem('user',JSON.stringify({id:'A',phone:'fixture',name:'Fixture',role:'CLIENT'}));
  const requests=[],navigations=[];
  globalThis.fetch=(...args)=>{requests.push(args);throw new Error('Navigation must not request business changes');};
  const root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(React.createElement(RouterFixture,{navigations},
    React.createElement(LocaleProvider,{initialLanguage:language},React.createElement(AuthProvider,null,
      React.createElement(MasterWorkspace,null,React.createElement('p',null,'Workspace content')))))));
  return {requests,navigations,cleanup:()=>act(async()=>root.unmount())};
}
const activeHrefs=()=>[...document.querySelectorAll('nav a[aria-current="page"]')].map(link=>link.getAttribute('href'));
const navigateToLink=href=>act(async()=>{
  const destination=document.querySelector(`nav a[href="${href}"]`).getAttribute('href');
  window.history.pushState({},'',destination);
  window.dispatchEvent(new window.PopStateEvent('popstate'));
});

for(const language of ['ru','kk','en'])test(`${language} workspace marks planned instead of overview for the planned query`,async()=>{
  const a=await mount('/?tab=planned&source=workspace',language);
  try {assert.deepEqual(activeHrefs(),['/?tab=planned']);assert.deepEqual(a.requests,[]);}finally{await a.cleanup();}
});
for(const href of ['/','/?tab=urgent','/?tab=invalid'])test(`workspace safely selects overview for ${href}`,async()=>{
  const a=await mount(href);
  try {assert.deepEqual(activeHrefs(),['/']);assert.deepEqual(a.requests,[]);}finally{await a.cleanup();}
});
test('workspace keeps history/dispute navigation independent of dashboard query',async()=>{
  for(const [href,expected] of [['/history?filter=active&tab=planned','/history'],['/disputes/owned-id?tab=planned','/disputes']]){
    const a=await mount(href);
    try {assert.deepEqual(activeHrefs(),[expected]);assert.deepEqual(a.requests,[]);}finally{await a.cleanup();}
  }
});
test('workspace sidebar follows planned and overview navigation with native Back and Forward',async()=>{
  const a=await mount('/');
  try {
    await navigateToLink('/?tab=planned');assert.equal(window.location.search,'?tab=planned');assert.deepEqual(activeHrefs(),['/?tab=planned']);
    await navigateToLink('/');assert.deepEqual(activeHrefs(),['/']);
    await traverseHistory('back');assert.deepEqual(activeHrefs(),['/?tab=planned']);
    await traverseHistory('back');assert.deepEqual(activeHrefs(),['/']);
    await traverseHistory('forward');assert.deepEqual(activeHrefs(),['/?tab=planned']);
    assert.deepEqual(a.requests,[]);
  } finally {await a.cleanup();}
});
