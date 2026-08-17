'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Alert, ArrowLeftIcon, Button, Input, Spinner } from '@masterqala/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Step = 'splash' | 'phone' | 'sms';

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>('splash');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(60);

  useEffect(() => {
    if (step !== 'splash') return;
    const timer = setTimeout(() => setStep('phone'), 1200);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (step !== 'sms' || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendIn]);

  const normalizedPhone = `+7${phone.replace(/\D/g, '').slice(-10)}`;

  async function requestCode() {
    if (phone.replace(/\D/g, '').length < 10) {
      setPhoneError(t('auth.phoneInvalid'));
      return;
    }
    setPhoneError('');
    setError('');
    setSubmitting(true);
    try {
      await api('/auth/request-code', { method: 'POST', body: JSON.stringify({ phone: normalizedPhone }) });
      setResendIn(60);
      setStep('sms');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function verify() {
    if (code.length < 6) {
      setCodeError(t('auth.codeInvalid'));
      return;
    }
    setCodeError('');
    setError('');
    setSubmitting(true);
    try {
      const res = await api('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone: normalizedPhone, code }),
      });
      login(res.accessToken, res.user);
      router.push('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'splash') {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-primary px-6">
        <span className="flex size-22 items-center justify-center rounded-lg bg-surface text-4xl font-extrabold text-primary">
          M
        </span>
        <p className="text-2xl font-extrabold tracking-tight text-on-primary sm:text-3xl">MasterQala</p>
        <p className="text-sm text-on-primary">{t('auth.splashTagline')}</p>
        <Spinner size={26} label={t('common.loading')} className="mt-3 text-on-primary" />
        <Button variant="secondary" className="mt-3" onClick={() => setStep('phone')}>
          {t('auth.splashSkip')}
        </Button>
      </div>
    );
  }

  return (
    <main id="main" className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-start gap-3.5 sm:justify-center bg-background px-6 py-6">
      {step === 'sms' && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          icon={<ArrowLeftIcon size={18} />}
          onClick={() => setStep('phone')}
        >
          {t('auth.changeNumber')}
        </Button>
      )}

      {step === 'phone' && (
        <>
          <h1 className="mt-6 text-2xl leading-tight font-extrabold text-ink sm:text-3xl">{t('auth.phoneTitle')}</h1>
          <p className="text-sm text-ink-soft">{t('auth.phoneSubtitle')}</p>
          <Input
            label={t('auth.phoneLabel')}
            prefix="+7"
            required
            className="font-bold"
            fieldClassName="mt-2"
            placeholder={t('auth.phonePlaceholder')}
            value={phone}
            error={phoneError}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
          />
          <p className="text-xs leading-normal text-ink-soft">
            {t('auth.termsPrefix')} <span className="font-bold text-primary">{t('auth.termsLink')}</span>
          </p>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="mt-auto sm:hidden" />
          <Button fullWidth size="lg" loading={submitting} onClick={requestCode}>
            {t('auth.getCodeButton')}
          </Button>
        </>
      )}

      {step === 'sms' && (
        <>
          <h1 className="mt-2.5 text-2xl leading-tight font-extrabold text-ink sm:text-3xl">{t('auth.smsTitle')}</h1>
          <p className="text-sm text-ink-soft">{t('auth.smsSubtitle', { phone: `+7 ${phone}` })}</p>
          {/* Раньше код набирался в шести декоративных квадратах поверх скрытого
           * поля: у контрола не было ни подписи, ни видимого значения. */}
          <Input
            label={t('auth.codeLabel')}
            required
            fieldClassName="mt-2"
            className="text-center text-xl font-extrabold tracking-[0.4em]"
            value={code}
            error={codeError}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
          />
          <div className="text-xs text-ink-soft">
            {resendIn > 0 ? (
              t('auth.resendIn', { time: formatTime(resendIn) })
            ) : (
              <Button variant="ghost" size="sm" onClick={requestCode}>
                {t('auth.resendNow')}
              </Button>
            )}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="mt-auto sm:hidden" />
          <Button fullWidth size="lg" loading={submitting} onClick={verify}>
            {t('auth.loginButton')}
          </Button>
        </>
      )}
    </main>
  );
}
