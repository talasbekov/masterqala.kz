'use client';
import {useRouter} from 'next/navigation';
import {LoginForm,phoneLoginText,useLocale,usePhoneLogin} from '@masterqala/ui';
import {api} from '../../../lib/api';
import {useAuth} from '../../../lib/auth';
export default function LoginPage() {
  const {language}=useLocale();
  const {login}=useAuth();
  const router=useRouter();
  const flow=usePhoneLogin({flowKey:'operator-login',request:api,onAuthenticated:login,onSuccess:()=>router.push('/')});
  const t=(key:string,values?:Record<string,string>)=>phoneLoginText(language,key,values);
  return <div className="mq-auth-shell"><main className="mq-auth-main"><div className="mq-login-content">
    <h1><span className="mq-login-title-web">{t(flow.step==='phone'?'auth.pageTitle':'auth.smsTitle')}</span><span className="mq-login-title-mobile">{t(flow.step==='phone'?'auth.phoneTitle':'auth.smsTitle')}</span></h1>
    <p>{t('auth.pageSubtitle')}</p>
    <LoginForm {...flow} t={t}/>
  </div></main></div>;
}
