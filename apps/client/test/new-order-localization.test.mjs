import assert from 'node:assert/strict';import test from 'node:test';import {readFileSync} from 'node:fs';import i18next from 'i18next';
const resources=Object.fromEntries(['ru','kk','en'].map(language=>[language,{translation:JSON.parse(readFileSync(new URL(`../lib/locales/${language}.json`,import.meta.url),'utf8'))}]));
test('all three languages cover current-order/common keys and retain identical interpolation variables without fallback',async()=>{
 const placeholders=value=>[...value.matchAll(/\{\{(.*?)\}\}/g)].map(match=>match[1]).sort();
 for(const section of ['common','newOrder'])for(const [key,value] of Object.entries(resources.ru.translation[section]))for(const language of ['kk','en']){const translated=resources[language].translation[section]?.[key];assert.equal(typeof translated,'string',`${language}.${section}.${key}`);assert.ok(translated.length);assert.deepEqual(placeholders(translated),placeholders(value),`${language}.${section}.${key}`);}
 const i18n=i18next.createInstance();await i18n.init({resources,lng:'en',fallbackLng:false,interpolation:{escapeValue:false}});
 for(const language of ['ru','kk','en']){await i18n.changeLanguage(language);assert.ok(!i18n.t('common.stepOf',{n:3,total:4}).includes('{{'));assert.ok(!i18n.t('newOrder.step4Submit',{price:'2500'}).includes('{{'));assert.match(i18n.t('newOrder.step4Submit',{price:'2500'}),/2500/);}
});
test('payment copy contains no fabricated card/account and all pilot/category text uses translations',()=>{
 for(const language of ['ru','kk','en']){const label=resources[language].translation.newOrder.step4PaymentMethod;assert.doesNotMatch(label,/4821|Kaspi Gold|\d{4}/);assert.match(label,language==='ru'?/недоступны/:language==='kk'?/қолжетімсіз/:/unavailable/);}
 const page=readFileSync(new URL('../app/(app)/order/new/page.tsx',import.meta.url),'utf8');for(const key of ['freePilotNote','freePilotPaymentLabel','freePilotCancelNote','freePilotSubmit'])assert.ok(page.includes(`t('newOrder.${key}')`));assert.match(page,/defaultValue:category.name/);assert.match(page,/categoryName\(c\)/);
});
test('English photo counts are grammatical for one photo as well as multiple photos',async()=>{
 const i18n=i18next.createInstance();await i18n.init({resources,lng:'en',fallbackLng:false,interpolation:{escapeValue:false}});assert.equal(i18n.t('common.photosCount',{n:1}),'Photos: 1');assert.equal(i18n.t('common.photosCount',{n:5}),'Photos: 5');
});
