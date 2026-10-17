import test from 'node:test';import assert from 'node:assert/strict';
import {safeMasterReturn,masterLoginUrl} from '../.test-build/test/safety-entry.js';
test('master login preserves owned workspace destinations and rejects external or unsupported routes',()=>{
 for(const path of ['/history?filter=active','/become-master','/order/abc/dispute','/planned/abc','/disputes/abc','/?tab=planned&planned=abc']){assert.equal(safeMasterReturn(path),path);assert.equal(new URLSearchParams(masterLoginUrl(path).split('?')[1]).get('returnTo'),path);}
 for(const path of ['https://outside.test','//outside.test','/%2foutside.test','/\\outside.test','/login?returnTo=/history','/operator','/payments','/%zz','/order/%0Afoo'])assert.equal(safeMasterReturn(path),'/');
 assert.equal(masterLoginUrl('/'),'/login');
});
