'use client';
import {useRouter} from 'next/navigation';
import {LoginForm,LOCALE_COPY,phoneLoginText,useLocale,usePhoneLogin} from '@masterqala/ui';
import {api} from '../../../lib/api';
import {useAuth} from '../../../lib/auth';
import {operatorText} from '../../../lib/operator-copy';
export default function LoginPage() {
  const {language,setLanguage}=useLocale();
  const {login}=useAuth();
  const router=useRouter();
  const flow=usePhoneLogin({flowKey:'operator-login',request:api,onAuthenticated:login,onSuccess:()=>router.push('/')});
  const t=(key:string,values?:Record<string,string>)=>phoneLoginText(language,key,values);
  return <div className="mq-auth-shell operator-auth-shell"><header className="operator-auth-header"><a href="/login" className="operator-auth-brand">MasterQala</a><p>{operatorText(language,'operator')}</p><div className="operator-auth-locales" aria-label={LOCALE_COPY[language].title}>{(['ru','kk','en'] as const).map(locale=><button key={locale} type="button" lang={locale} aria-pressed={language===locale} onClick={()=>setLanguage(locale)}>{locale==='kk'?'KZ':locale.toUpperCase()}</button>)}</div></header><main className="mq-auth-main"><div className="mq-login-content">
    <h1><span className="mq-login-title-web">{t(flow.step==='phone'?'auth.pageTitle':'auth.smsTitle')}</span><span className="mq-login-title-mobile">{t(flow.step==='phone'?'auth.phoneTitle':'auth.smsTitle')}</span></h1>
    <p>{operatorText(language,'roleRequired')}</p>
    <LoginForm {...flow} t={t}/>
  </div></main></div>;
}
