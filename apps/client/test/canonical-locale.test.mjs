import assert from 'node:assert/strict';
import test from 'node:test';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createInstance} from 'i18next';
import {I18nextProvider,initReactI18next,useTranslation} from 'react-i18next';
import {LocaleProvider,useLocale} from '@masterqala/ui';
import {LocaleI18nBridge} from '../.test-build/components/LocaleI18nBridge.js';
test('canonical provider selection translates mounted legacy content and preserves order draft/token',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/order/1842'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
 localStorage.setItem('token','test-session');localStorage.setItem('orderDraft','approved quote v3');
 const i18n=createInstance();await i18n.use(initReactI18next).init({lng:'ru',resources:{ru:{translation:{heading:'Ваш заказ'}},kk:{translation:{heading:'Тапсырысыңыз'}},en:{translation:{heading:'Your order'}}}});
 let change;const calls=[];
 function Content(){const {setLanguage}=useLocale();change=setLanguage;const {t}=useTranslation();const [draft]=React.useState('approved quote v3');return React.createElement('section',null,React.createElement('h1',null,t('heading')),React.createElement('input',{value:draft,readOnly:true}));}
 const root=createRoot(document.getElementById('root'));
 try{await act(async()=>root.render(React.createElement(LocaleProvider,{initialLanguage:'ru',onChange:lang=>calls.push(lang)},React.createElement(I18nextProvider,{i18n},React.createElement(LocaleI18nBridge,null,React.createElement(Content))))));
 const node=document.querySelector('input');
 for(const lang of ['kk','en','ru']){await act(async()=>change(lang));assert.equal(i18n.language,lang);assert.equal(localStorage.getItem('mq.locale'),lang);assert.match(document.cookie,new RegExp(`mq_locale=${lang}`));assert.equal(document.documentElement.lang,lang);assert.equal(document.querySelector('input'),node);assert.equal(node.value,'approved quote v3');}
 assert.deepEqual(calls,['kk','en','ru']);assert.equal(localStorage.getItem('token'),'test-session');assert.equal(localStorage.getItem('orderDraft'),'approved quote v3');assert.equal(localStorage.getItem('masterqala.locale'),null);
 }finally{await act(async()=>root.unmount());dom.window.close();}
});
