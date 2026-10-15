import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import kk from './locales/kk.json';
import en from './locales/en.json';

const valid = (value: unknown): value is 'ru'|'kk'|'en' => value==='ru'||value==='kk'||value==='en';
function savedLanguage() {
  if(typeof window==='undefined')return 'ru';
  try {const value=window.localStorage.getItem('mq.locale');return valid(value)?value:'ru';}catch{return 'ru';}
}
i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
    en: { translation: en },
  },
  lng: savedLanguage(),
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged',language=>{
  if(typeof window==='undefined'||!valid(language))return;
  try {window.localStorage.setItem('mq.locale',language);}catch{/* Display remains usable without storage. */}
  document.cookie=`mq_locale=${language}; Path=/; SameSite=Lax; Max-Age=31536000`;
  document.documentElement.lang=language;
  window.dispatchEvent(new CustomEvent('mq:locale',{detail:language}));
});
if(typeof window!=='undefined')window.addEventListener('mq:locale',event=>{
  const language=(event as CustomEvent).detail;
  if(valid(language)&&i18n.language!==language)void i18n.changeLanguage(language);
});
export default i18n;
