import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as ui from '../dist/index.js';

test('shared account presenters are available without binding to an application i18next instance',()=>{
 for(const name of ['ProfileForm','AddressEditor','AddressDetails']) assert.equal(typeof ui[name],'function',name);
 const index=readFileSync(new URL('../src/index.ts',import.meta.url),'utf8');
 assert.match(index,/ProfileForm/);assert.match(index,/AddressEditor/);
});
test('Next adapters use the same shared presenters and retain translated responsive styles',()=>{
 for(const name of ['ProfileForm','AddressEditor']) {
  const adapter=readFileSync(new URL(`../../../apps/client/components/${name}.tsx`,import.meta.url),'utf8');
  assert.match(adapter,/@masterqala\/ui/);assert.match(adapter,/useTranslation/);
  assert.doesNotMatch(adapter,/<form/);
 }
 const css=readFileSync(new URL('../src/account.css',import.meta.url),'utf8');
 assert.match(css,/\.mq-profile-columns\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
 const globals=readFileSync(new URL('../../../apps/client/app/globals.css',import.meta.url),'utf8');
 assert.match(globals,/@import "@masterqala\/ui\/account.css"/);
 assert.match(css,/\.mq-address-details\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
});
