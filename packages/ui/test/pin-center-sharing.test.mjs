import test from 'node:test';import assert from 'node:assert/strict';
import * as ui from '../dist/index.js';
test('public shared entry exports the reviewed platform-neutral pin center controller',()=>assert.equal(typeof ui.createPinCenterSync,'function'));
