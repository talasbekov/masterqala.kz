'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { safeReturnPath } from '../../../lib/auth-return';
import { usePhoneLogin } from '../../../components/usePhoneLogin';
import { LoginForm } from '../../../components/LoginForm';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import {useLocale} from '@masterqala/ui';
import {designCopy} from '../../../components/desktop-service/design-copy';

export default function LoginPage() {
  const { t } = useTranslation();
  const {language}=useLocale(),copy=designCopy[language];
  const masterUrl=process.env.NEXT_PUBLIC_MASTER_APP_URL;
  const { login } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const flow = usePhoneLogin({ flowKey: safeReturnPath(search.get('returnTo')), request: api, onAuthenticated: login,
    onSuccess: () => router.replace(safeReturnPath(search.get('returnTo'))) });
  const { step } = flow;

  return <div className="mq-login-content">
    <h1><span className="mq-login-title-web">{t(step === 'phone' ? 'auth.pageTitle' : 'auth.smsTitle')}</span><span className="mq-login-title-mobile">{t(step === 'phone' ? 'auth.phoneTitle' : 'auth.smsTitle')}</span></h1>
    <p>{t('auth.pageSubtitle')}</p>
    <div className="client-login-columns"><LoginForm {...flow} /><aside className="client-login-aside"><h2>{copy.masterHeading}</h2><p>{copy.masterBody}</p>{masterUrl&&/^https?:\/\//.test(masterUrl)?<a href={masterUrl}>{copy.masterAction}</a>:<span aria-disabled="true">{copy.masterAction}</span>}</aside></div>
  </div>;
}
