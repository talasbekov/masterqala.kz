'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Step = 'splash' | 'phone' | 'sms';

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
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
      router.push('/');
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
        <div className="text-[28px] font-extrabold tracking-tight text-white">MasterQala · Панель оператора</div>
        <div className="text-sm text-fill">Заявки, пользователи, мастера и споры в одной панели</div>
        <div className="mt-3 h-6.5 w-6.5 animate-spin rounded-full border-[3px] border-fill border-t-white" />
      </button>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-3.5 bg-background px-6 py-5.5">
      {step === 'sms' && (
        <button
          type="button"
          onClick={() => setStep('phone')}
          className="self-start text-sm font-extrabold text-primary"
        >
          ← Изменить номер
        </button>
      )}

      {step === 'phone' && (
        <>
          <div className="mt-6 text-[26px] font-extrabold leading-tight text-ink">Вход по номеру телефона</div>
          <div className="text-sm text-ink-soft">Отправим SMS с кодом подтверждения</div>
          <div className="mt-2 flex items-center gap-2 rounded-md border-[1.5px] border-border bg-surface px-4 py-3.5">
            <span className="text-[17px] font-extrabold text-ink">+7</span>
            <input
              className="flex-1 bg-transparent text-[17px] font-bold text-ink outline-none placeholder:text-muted"
              placeholder="700 000 00 01"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              autoFocus
            />
          </div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={requestCode}
            disabled={submitting || phone.replace(/\D/g, '').length < 10}
            className="rounded-pill bg-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            Получить код
          </button>
        </>
      )}

      {step === 'sms' && (
        <>
          <div className="mt-2.5 text-[26px] font-extrabold leading-tight text-ink">Код из SMS</div>
          <div className="text-sm text-ink-soft">Отправили на +7 {phone}</div>
          <div className="relative mt-2 w-fit" onClick={() => codeInputRef.current?.focus()}>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`flex h-14 w-10 items-center justify-center rounded-md border-[1.5px] bg-surface text-xl font-extrabold text-ink ${
                    code[i] ? 'border-primary' : 'border-border'
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
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="absolute inset-0 opacity-0"
            />
          </div>
          <div className="text-[13px] text-ink-soft">
            {resendIn > 0 ? (
              `Отправить снова через ${formatTime(resendIn)}`
            ) : (
              <button type="button" onClick={requestCode} className="font-bold text-primary">
                Отправить код повторно
              </button>
            )}
          </div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="mt-auto" />
          <button
            type="button"
            onClick={verify}
            disabled={submitting || code.length < 6}
            className="rounded-pill bg-primary p-4 text-base font-extrabold text-white disabled:opacity-40"
          >
            Войти
          </button>
        </>
      )}
    </div>
  );
}
