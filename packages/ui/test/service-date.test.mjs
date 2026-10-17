import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../dist/index.js';

const months=['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'];
// Chrome's reduced Kazakh ICU data returns M01..M12 even when kk is supported.
// Retain real Intl date/time calculations while reproducing only that missing data.
function withMissingMonthData(run) {
  const Original=Intl.DateTimeFormat;
  Intl.DateTimeFormat=function(locale,options) {
    const real=new Original(locale,options);
    if(String(locale).startsWith('kk')&&options.month==='long') {
      const originalParts=real.formatToParts.bind(real);
      real.formatToParts=value=>originalParts(value).map(part=>part.type==='month'
        ? {type:'month',value:'M'+new Original('en-GB',{timeZone:options.timeZone,month:'2-digit'}).format(value)}
        : part);
    }
    return real;
  };
  try {run();} finally {Intl.DateTimeFormat=Original;}
}
for(const [index,month] of months.entries()) {
  test('Kazakh service date names month '+(index+1)+' when ICU lacks its name',()=>{
    assert.equal(typeof ui.formatServiceDate,'function','shared service date formatter must be exported');
    withMissingMonthData(()=>{
      const value=ui.formatServiceDate(new Date(Date.UTC(2026,index,15,7,30)),'kk',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
      assert.ok(value.includes(month),value);
      assert.doesNotMatch(value,/M\d{1,2}/);
      assert.ok(value.includes('15'),value);
      assert.ok(value.includes('12:30'),value);
    });
  });
}
test('Astana date crosses month and year at UTC+5 independently of device zone',()=>{
  assert.equal(typeof ui.formatServiceDate,'function');
  const previous=process.env.TZ;
  try {
    for(const zone of ['UTC','America/Los_Angeles','Asia/Tokyo']) {
      process.env.TZ=zone;
      const date=ui.formatServiceDate(new Date('2026-12-31T19:30:00Z'),'kk-KZ',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
      assert.ok(date.includes('қаңтар')&&date.includes('2027')&&date.includes('00:30'),date);
      assert.doesNotMatch(date,/желтоқсан|2026/);
    }
  } finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('service date keeps IANA historic offset and RU/EN native month formatting',()=>{
  assert.equal(typeof ui.formatServiceDate,'function');
  const options={day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'};
  const date=new Date('2024-01-31T18:30:00Z');
  assert.match(ui.formatServiceDate(date,'kk',options),/ақпан/);
  assert.match(ui.formatServiceDate(date,'kk',options),/00:30/);
  for(const [language,locale] of [['ru','ru-RU'],['en','en-GB']])
    assert.equal(ui.formatServiceDate(date,language,options),new Intl.DateTimeFormat(locale,{...options,timeZone:'Asia/Almaty'}).format(date));
});
