import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {useTranslation} from 'react-i18next';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
import {PathnameContext,SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js';
import {Providers} from '../.test-build/test/legacy-locale-entry.js';

function Probe(){const {t}=useTranslation();return React.createElement('h1',null,t('navigation.order'));}
const router={push(){},replace(){},back(){},prefetch(){}};
function render(language){return renderToString(React.createElement(AppRouterContext.Provider,{value:router},React.createElement(PathnameContext.Provider,{value:'/login'},React.createElement(SearchParamsContext.Provider,{value:new URLSearchParams()},React.createElement(Providers,{initialLanguage:language},React.createElement(Probe))))));}
for(const [language,label] of [['ru','Заказать мастера'],['kk','Шебер шақыру'],['en','Book a master']]){
 test(`${language}: server translation uses the same initial locale as the HTML and shared provider`,()=>assert.ok(render(language).includes(label)));
}
test('separate SSR renders never inherit the previous request language',()=>{
 assert.ok(render('en').includes('Book a master'));
 assert.ok(render('ru').includes('Заказать мастера'));
 assert.ok(render('en').includes('Book a master'));
});
