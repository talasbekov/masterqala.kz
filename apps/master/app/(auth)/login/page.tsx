'use client';
import {useRouter} from 'next/navigation';
import {LoginForm,phoneLoginText,useLocale,usePhoneLogin} from '@masterqala/ui';
import {safeMasterReturn} from '../../../lib/auth-return';
import {MasterWorkspace} from '../../../components/MasterWorkspace';
import {api} from '../../../lib/api';
import {useAuth} from '../../../lib/auth';
export default function LoginPage() {
  const {language}=useLocale();
  const {login}=useAuth();
  const router=useRouter();
  const flow=usePhoneLogin({flowKey:'master-login',request:api,onAuthenticated:login,onSuccess:()=>router.replace(safeMasterReturn(new URLSearchParams(window.location.search).get('returnTo')))});
  const t=(key:string,values?:Record<string,string>)=>phoneLoginText(language,key,values);
  return <MasterWorkspace anonymous><div className="mq-auth-shell"><div className="mq-auth-main"><div className="mq-login-content">
    <h1><span className="mq-login-title-web">{t(flow.step==='phone'?'auth.pageTitle':'auth.smsTitle')}</span><span className="mq-login-title-mobile">{t(flow.step==='phone'?'auth.phoneTitle':'auth.smsTitle')}</span></h1>
    <p>{t('auth.pageSubtitle')}</p>
    <div className="mq-master-login-grid"><LoginForm {...flow} t={t}/><aside className="mq-master-login-note"><h2>{t('auth.accountTitle')}</h2><p>{t('auth.accountDescription')}</p></aside></div>
  </div></div></div></MasterWorkspace>;
}
