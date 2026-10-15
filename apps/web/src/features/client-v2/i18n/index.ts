import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import kk from './locales/kk.json';
import en from './locales/en.json';

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
    en: { translation: en },
  },
  lng: typeof document==='undefined'?'ru':(localStorage.getItem('mq.locale')??'ru'),
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged',language=>{if(typeof window==='undefined')return;if(!['ru','kk','en'].includes(language))return;localStorage.setItem('mq.locale',language);document.cookie=`mq_locale=${language}; Path=/; SameSite=Lax; Max-Age=31536000`;document.documentElement.lang=language;window.dispatchEvent(new CustomEvent('mq:locale',{detail:language}));});
if(typeof window!=='undefined')window.addEventListener('mq:locale',event=>{const language=(event as CustomEvent).detail;if(['ru','kk','en'].includes(language)&&i18n.language!==language)void i18n.changeLanguage(language);});
export default i18n;
