import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translate,money,reviewCount} from '../src/locale-data.ts';
test('direct quote labels preserve the approved amount across languages',()=>{
  for(const lang of ['ru','kk','en'])assert.ok(translate(lang,'approve',{amount:money(lang,14000)}).includes('14'));
  assert.equal(translate('en','accept'),'Accept work');
  assert.equal(reviewCount('ru',1),'1 отзыв');assert.equal(reviewCount('ru',2),'2 отзыва');assert.equal(reviewCount('ru',5),'5 отзывов');
  assert.equal(reviewCount('en',2),'2 reviews');assert.equal(reviewCount('kk',2),'2 пікір');
});
test('master additional-work instruction explicitly requires customer consent in every language',()=>{
 assert.match(translate('ru','additionalConsent'),/с клиентом/);
 assert.match(translate('kk','additionalConsent'),/тапсырыс берушінің келісімін/);
 assert.match(translate('en','additionalConsent'),/customer’s approval/);
 assert.doesNotMatch(translate('en','additionalConsent'),/^Approve additional work/);
});
