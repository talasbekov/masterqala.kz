import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('public shell connects the canonical centered dialog stylesheet and shared Button utility sources',()=>{
 const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 assert.match(css,/@import\s+"@masterqala\/ui\/locale\.css"/);
 assert.match(css,/@source\s+"\.\.\/\.\.\/\.\.\/packages\/ui\/src"/);
 const dialog=readFileSync(new URL('../../../packages/ui/src/locale.css',import.meta.url),'utf8');assert.match(dialog,/margin:\s*auto/);assert.match(dialog,/max-height:\s*calc\(100dvh - 48px\)/);
});
