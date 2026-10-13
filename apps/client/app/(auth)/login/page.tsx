'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { safeReturnPath } from '@/lib/auth-return';
import { usePhoneLogin } from '@/components/usePhoneLogin';
import { LoginForm } from '@/components/LoginForm';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const flow = usePhoneLogin({ request: api, onAuthenticated: login,
    onSuccess: () => router.replace(safeReturnPath(search.get('returnTo'))) });
  const { step } = flow;

  return <div className="mq-login-content">
    <h1><span className="mq-login-title-web">{t(step === 'phone' ? 'auth.pageTitle' : 'auth.smsTitle')}</span><span className="mq-login-title-mobile">{t(step === 'phone' ? 'auth.phoneTitle' : 'auth.smsTitle')}</span></h1>
    <p>{t('auth.pageSubtitle')}</p>
    <LoginForm {...flow} />
  </div>;
}
