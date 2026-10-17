import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {LocaleProvider,LanguageDialogController} from '@masterqala/ui';import {Header,Footer} from '../.test-build/public-entry.js';
for(const language of ['ru','kk','en'])test(`${language} header/footer are localized without placeholder contacts`,()=>{
 const html=renderToStaticMarkup(React.createElement(LocaleProvider,{initialLanguage:language},React.createElement(LanguageDialogController,{href:'/',router:{push(){},replace(){},back(){}},locale:language,onSelect(){}},React.createElement(Header,{appUrl:'https://client.example'}),React.createElement(Footer,{phone:null,email:null}))));
 assert.ok(html.includes(({ru:'Услуги',kk:'Қызметтер',en:'Services'})[language]));assert.ok(!html.includes('заменить'));assert.ok(!html.includes('700 000'));assert.ok(!html.includes('support@masterqala.kz'));
});
