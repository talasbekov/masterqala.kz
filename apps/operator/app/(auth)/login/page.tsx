'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const { login } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>('splash');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
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
        <span className="flex h-22 w-22 items-center justify-center rounded-lg bg-surface text-4xl font-extrabold text-primary">
          M
        </span>
        <span className="text-2xl font-extrabold tracking-tight text-on-primary">
          MasterQala · Панель оператора
        </span>
        <span className="text-sm text-on-primary">
          Заявки, пользователи, мастера и споры в одной панели
        </span>
        <span className="mt-3 text-on-primary">
          <Spinner size={26} label="Загрузка" />
        </span>
      </button>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-start gap-3.5 sm:justify-center bg-background px-6 py-5.5">
      {step === 'sms' && (
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeftIcon size={16} />}
          onClick={() => setStep('phone')}
          className="self-start"
        >
          Изменить номер
        </Button>
      )}

      {step === 'phone' && (
        <>
          <h1 className="mt-6 text-2xl font-extrabold text-ink">Вход по номеру телефона</h1>
          <p className="text-sm text-ink-soft">Отправим SMS с кодом подтверждения</p>
          <Input
            label="Номер телефона"
            prefix="+7"
            placeholder="700 000 00 01"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            className="mt-2"
          />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="mt-auto sm:hidden" />
          <Button
            onClick={requestCode}
            loading={submitting}
            disabled={phone.replace(/\D/g, '').length < 10}
            fullWidth
          >
            Получить код
          </Button>
        </>
      )}

      {step === 'sms' && (
        <>
          <h1 className="mt-2.5 text-2xl font-extrabold text-ink">Код из SMS</h1>
          <p className="text-sm text-ink-soft">Отправили на +7 {phone}</p>
          <div className="relative mt-2 w-fit">
            {/* Видимые ячейки — оформление; ввод принимает поле ниже, у него
                есть настоящая подпись, а не только placeholder. */}
            <div className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={`flex h-14 w-10 items-center justify-center rounded-md border-2 bg-surface text-xl font-extrabold text-ink ${
                    code[i] ? 'border-primary' : 'border-border-strong'
                  }`}
                >
                  {code[i] ?? ''}
                </span>
              ))}
            </div>
            <Input
              label="Код из SMS"
              labelHidden
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="absolute inset-0 h-full opacity-0"
              fieldClassName="absolute inset-0"
            />
          </div>
          <p className="text-xs text-ink-soft">
            {resendIn > 0 ? (
              `Отправить снова через ${formatTime(resendIn)}`
            ) : (
              <Button variant="ghost" size="sm" onClick={requestCode} loading={submitting}>
                Отправить код повторно
              </Button>
            )}
          </p>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="mt-auto sm:hidden" />
          <Button onClick={verify} loading={submitting} disabled={code.length < 6} fullWidth>
            Войти
          </Button>
        </>
      )}
    </div>
  );
}
