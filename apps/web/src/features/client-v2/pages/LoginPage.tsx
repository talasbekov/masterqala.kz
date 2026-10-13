import {useNavigate,useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {LoginForm,usePhoneLogin,safeReturnPath} from '@masterqala/ui';
import {api} from '../../../api';
import {useAuth} from '../../../auth';
export default function LoginPage(){
 const {t}=useTranslation();const {login}=useAuth();const navigate=useNavigate();const [search]=useSearchParams();const target=safeReturnPath(search.get('returnTo'));
 const flow=usePhoneLogin({flowKey:target,request:api,onAuthenticated:login,onSuccess:()=>navigate(target,{replace:true})});
 return <div className="mq-auth-shell"><main className="mq-auth-main"><div className="mq-login-content">
  <h1><span className="mq-login-title-web">{t(flow.step==='phone'?'auth.pageTitle':'auth.smsTitle')}</span><span className="mq-login-title-mobile">{t(flow.step==='phone'?'auth.phoneTitle':'auth.smsTitle')}</span></h1>
  <p>{t('auth.pageSubtitle')}</p><LoginForm {...flow} t={(key,values)=>t(key,values)}/>
 </div></main></div>;
}
