import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as ui from '../dist/index.js';
test('reviewed phone/OTP presenters and injected controller have one shared implementation',()=>{
 assert.equal(typeof ui.LoginForm,'function');assert.equal(typeof ui.usePhoneLogin,'function');
 const form=readFileSync(new URL('../../../apps/client/components/LoginForm.tsx',import.meta.url),'utf8');assert.doesNotMatch(form,/<form/);assert.match(form,/@masterqala\/ui/);
 const hook=readFileSync(new URL('../../../apps/client/components/usePhoneLogin.ts',import.meta.url),'utf8');assert.doesNotMatch(hook,/requestPending/);assert.match(hook,/@masterqala\/ui/);
});
test('both apps can import the scoped login stylesheet without losing Next auth viewport placement',()=>{
 const p=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));assert.equal(p.exports['./login.css'],'./src/login.css');
 const css=readFileSync(new URL('../src/login.css',import.meta.url),'utf8');assert.match(css,/\.mq-auth-shell\s*\{[^}]*min-height:\s*100dvh/);assert.match(css,/\.mq-login-actions\s*\{[^}]*margin-top:\s*auto/);
 const globals=readFileSync(new URL('../../../apps/client/app/globals.css',import.meta.url),'utf8');assert.match(globals,/@import "@masterqala\/ui\/login.css"/);
});
