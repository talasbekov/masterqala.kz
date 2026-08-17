import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, ArrowLeftIcon, Button, Field, Input, Spinner, useFieldIds } from '@masterqala/ui';
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
  const codeIds = useFieldIds(undefined, error || undefined);

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
    setError('');
    setSubmitting(true);
    try {
      const res = await api('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ phone: normalizedPhone, code }),
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
      <button
        type="button"
        onClick={() => setStep('phone')}
        className="flex min-h-screen w-full flex-col items-center justify-center gap-4.5 bg-primary"
      >
        <div className="flex h-22 w-22 items-center justify-center rounded-lg bg-white text-4xl font-extrabold text-primary">
          M
        </div>
        <div className="text-2xl font-extrabold tracking-tight text-on-primary">MasterQala</div>
        <div className="text-sm text-fill">{t('auth.splashTagline')}</div>
        <div className="mt-3 text-on-primary">
          <Spinner size={26} label={t('common.loading')} />
        </div>
      </button>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-3.5 bg-background px-6 py-5.5">
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
          <h1 className="mt-6 text-2xl font-extrabold leading-tight text-ink">{t('auth.phoneTitle')}</h1>
          <div className="text-sm text-ink-soft">{t('auth.phoneSubtitle')}</div>
          <Input
            fieldClassName="mt-2"
            label={t('auth.phoneLabel')}
            prefix="+7"
            placeholder={t('auth.phonePlaceholder')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
          />
          <div className="text-xs leading-normal text-ink-soft">
            {t('auth.termsPrefix')} <span className="font-bold text-primary">{t('auth.termsLink')}</span>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="mt-auto" />
          <Button
            fullWidth
            size="lg"
            loading={submitting}
            disabled={phone.replace(/\D/g, '').length < 10}
            onClick={requestCode}
          >
            {t('auth.getCodeButton')}
          </Button>
        </>
      )}

      {step === 'sms' && (
        <>
          <h1 className="mt-2.5 text-2xl font-extrabold leading-tight text-ink">{t('auth.smsTitle')}</h1>
          <div className="text-sm text-ink-soft">{t('auth.smsSubtitle', { phone: `+7 ${phone}` })}</div>
          <Field label={t('auth.codeLabel')} ids={codeIds} error={error || undefined}>
            {/* Поле лежит поверх шести клеток: клетки — оформление, ввод идёт в него. */}
            <div className="relative w-fit">
              <div className="flex gap-1.5" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`flex h-14 w-10 items-center justify-center rounded-md border bg-surface text-xl font-extrabold text-ink ${
                      code[i] ? 'border-primary' : 'border-border-strong'
                    }`}
                  >
                    {code[i] ?? ''}
                  </div>
                ))}
              </div>
              <input
                ref={codeInputRef}
                id={codeIds.id}
                aria-describedby={codeIds.describedBy}
                aria-invalid={codeIds.invalid || undefined}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="absolute inset-0 opacity-0"
              />
            </div>
          </Field>
          <div className="text-xs text-ink-soft">
            {resendIn > 0 ? (
              t('auth.resendIn', { time: formatTime(resendIn) })
            ) : (
              <Button variant="ghost" size="sm" onClick={requestCode}>
                {t('auth.resendNow')}
              </Button>
            )}
          </div>
          <div className="mt-auto" />
          <Button fullWidth size="lg" loading={submitting} disabled={code.length < 6} onClick={verify}>
            {t('auth.loginButton')}
          </Button>
        </>
      )}
    </div>
  );
}
