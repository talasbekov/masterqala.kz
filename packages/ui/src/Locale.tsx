'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {translate,money,reviewCount,localeNames,type Locale} from './locale-data';
const valid=(value:unknown):value is Locale=>value==='ru'||value==='kk'||value==='en';
function saved():Locale {try {const value=localStorage.getItem('mq.locale');return valid(value)?value:'ru';}catch{return 'ru';}}
const Context=createContext({language:'ru' as Locale,setLanguage:(_language:Locale)=>{}});
export function LocaleProvider({children,initialLanguage,onChange}:{children:ReactNode;initialLanguage?:Locale;onChange?:(language:Locale)=>void}) {
  const [language,setValue]=useState<Locale>(()=>initialLanguage??(typeof window==='undefined'?'ru':saved()));
  function setLanguage(value:Locale) {
    setValue(value);
    try {localStorage.setItem('mq.locale',value);document.cookie=`mq_locale=${value}; Path=/; SameSite=Lax; Max-Age=31536000`;document.documentElement.lang=value;}catch{/* Session remains usable without persistent storage. */}
    onChange?.(value);
    window.dispatchEvent(new CustomEvent('mq:locale',{detail:value}));
  }
  useEffect(()=>{
    document.documentElement.lang=language;
  },[language]);
  useEffect(()=>{
    const update=(event:Event)=>{const value=(event as CustomEvent).detail??saved();if(valid(value)){setValue(value);document.documentElement.lang=value;}};
    window.addEventListener('mq:locale',update);window.addEventListener('storage',update);
    return()=>{window.removeEventListener('mq:locale',update);window.removeEventListener('storage',update);};
  },[]);
  return <Context.Provider value={{language,setLanguage}}>{children}</Context.Provider>;
}
export function useLocale() {
  const {language,setLanguage}=useContext(Context);
  return {language,setLanguage,t:(key:Parameters<typeof translate>[1],params?:Record<string,string|number>)=>translate(language,key,params),
    formatMoney:(value:number)=>money(language,value),formatReviews:(value:number)=>reviewCount(language,value)};
}
export function LanguageSelector() {
  const {language,setLanguage}=useLocale();
  return <select aria-label="Русский / Қазақша / English" value={language} onChange={event=>setLanguage(event.target.value as Locale)} className="min-h-11 max-w-full rounded-md bg-fill-soft px-3 text-sm text-primary">
    {Object.entries(localeNames).map(([code,label])=><option key={code} value={code}>{label}</option>)}
  </select>;
}
