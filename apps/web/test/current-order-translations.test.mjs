import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const dictionaries=Object.fromEntries(['ru','kk','en'].map(language=>[language,JSON.parse(readFileSync(new URL(`../src/features/client-v2/i18n/locales/${language}.json`,import.meta.url),'utf8'))]));
test('Vite common/current-order dictionary keys and interpolations match RU in all three languages',()=>{
 for(const language of ['kk','en'])for(const section of ['common','newOrder']){
  assert.deepEqual(Object.keys(dictionaries[language][section]??{}).sort(),Object.keys(dictionaries.ru[section]).sort());
  for(const [key,value] of Object.entries(dictionaries.ru[section])){assert.equal(typeof dictionaries[language][section][key],'string');assert.ok(dictionaries[language][section][key].trim());assert.deepEqual([...String(value).matchAll(/\{\{([^}]+)\}\}/g)].map(m=>m[1]).sort(),[...dictionaries[language][section][key].matchAll(/\{\{([^}]+)\}\}/g)].map(m=>m[1]).sort());}
 }
});
