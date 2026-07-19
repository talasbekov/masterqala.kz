import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { useAuth } from '../../../auth';

type Step = 'splash' | 'phone' | 'sms';

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('splash');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const codeInputRef = useRef<HTMLInputElement>(null);

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

  async function requestCode() {
    setError('');
    setSubmitting(true);
    try {
      await api('/auth/request-code', { method: 'POST', body: JSON.stringify({ phone: `+7${phone.replace(/\D/g, '')}` }) });
      setResendIn(60);
      setStep('sms');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function verify() {
    setError('');
    setSubmitting(true);
    try {
      const res = await api('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone: `+7${phone.replace(/\D/g, '')}`, code }),
      });
      login(res.accessToken, res.user);
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'splash') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4.5 bg-c2-primary"
        onClick={() => setStep('phone')}
      >
        <div className="flex h-22 w-22 items-center justify-center rounded-c2-lg bg-white text-4xl font-extrabold text-c2-primary">
          M
        </div>
        <div className="text-[28px] font-extrabold tracking-tight text-white">MasterQala</div>
        <div className="text-sm text-c2-fill">{t('auth.splashTagline')}</div>
        <div className="mt-3 h-6.5 w-6.5 animate-spin rounded-full border-[3px] border-c2-fill border-t-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-3.5 bg-c2-bg px-6 py-5.5">
      {step === 'sms' && (
        <button
          type="button"
          onClick={() => setStep('phone')}
          className="self-start text-sm font-extrabold text-c2-primary"
        >
          ← {t('auth.changeNumber')}
        </button>
      )}

      {step === 'phone' && (
        <>
          <div className="mt-6 text-[26px] font-extrabold leading-tight text-c2-ink">{t('auth.phoneTitle')}</div>
          <div className="text-sm text-c2-ink-soft">{t('auth.phoneSubtitle')}</div>
          <div className="mt-2 flex items-center gap-2 rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface px-4 py-3.5">
            <span className="text-[17px] font-extrabold text-c2-ink">+7</span>
            <input
              className="flex-1 bg-transparent text-[17px] font-bold text-c2-ink outline-none placeholder:text-c2-muted"
              placeholder={t('auth.phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              autoFocus
            />
          </div>
          <div className="text-xs leading-normal text-c2-ink-soft">
            {t('auth.termsPrefix')} <span className="font-bold text-c2-primary">{t('auth.termsLink')}</span>
          </div>
          {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={requestCode}
            disabled={submitting || phone.replace(/\D/g, '').length < 10}
            className="rounded-c2-pill bg-c2-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            {t('auth.getCodeButton')}
          </button>
        </>
      )}

      {step === 'sms' && (
        <>
          <div className="mt-2.5 text-[26px] font-extrabold leading-tight text-c2-ink">{t('auth.smsTitle')}</div>
          <div className="text-sm text-c2-ink-soft">{t('auth.smsSubtitle', { phone: `+7 ${phone}` })}</div>
          <div className="relative mt-2 w-fit" onClick={() => codeInputRef.current?.focus()}>
            <div className="flex gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex h-16 w-14 items-center justify-center rounded-c2-md border-[1.5px] bg-c2-surface text-2xl font-extrabold text-c2-ink ${
                    code[i] ? 'border-c2-primary' : 'border-c2-border'
                  }`}
                >
                  {code[i] ?? ''}
                </div>
              ))}
            </div>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="absolute inset-0 opacity-0"
            />
          </div>
          <div className="text-[13px] text-c2-ink-soft">
            {resendIn > 0 ? (
              t('auth.resendIn', { time: formatTime(resendIn) })
            ) : (
              <button type="button" onClick={requestCode} className="font-bold text-c2-primary">
                {t('auth.resendNow')}
              </button>
            )}
          </div>
          {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={verify}
            disabled={submitting || code.length < 4}
            className="rounded-c2-pill bg-c2-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            {t('auth.loginButton')}
          </button>
        </>
      )}
    </div>
  );
}
