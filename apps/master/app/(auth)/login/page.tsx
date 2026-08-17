'use client';
import { useEffect, useRef, useState } from 'react';
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
        aria-label="Продолжить ко входу"
        className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-primary px-6"
      >
        <span className="flex size-22 items-center justify-center rounded-lg bg-surface text-4xl font-extrabold text-primary">
          M
        </span>
        <span className="text-center text-3xl font-extrabold tracking-tight text-on-primary">
          MasterQala для мастеров
        </span>
        <span className="text-center text-sm text-on-primary">
          Заявки, ставки и выплаты в одном кабинете
        </span>
        <span className="mt-3 text-on-primary">
          <Spinner size={26} label="Загрузка" />
        </span>
      </button>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-start gap-3.5 sm:justify-center bg-background px-4 py-6 sm:px-6">
      {step === 'sms' && (
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeftIcon size={18} />}
          onClick={() => setStep('phone')}
          className="self-start"
        >
          Изменить номер
        </Button>
      )}

      {step === 'phone' && (
        <>
          <h1 className="mt-6 text-2xl font-extrabold leading-tight text-ink">Вход по номеру телефона</h1>
          <p className="text-sm text-ink-soft">Отправим SMS с кодом подтверждения</p>
          <Input
            label="Номер телефона"
            prefix="+7"
            placeholder="707 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            fieldClassName="mt-2"
          />
          <p className="text-xs leading-normal text-ink-soft">
            Продолжая, вы соглашаетесь с <span className="font-bold text-primary">условиями сервиса</span>
          </p>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="mt-auto sm:hidden" />
          <Button
            fullWidth
            size="lg"
            loading={submitting}
            loadingLabel="Отправляем код…"
            onClick={requestCode}
            disabled={phone.replace(/\D/g, '').length < 10}
          >
            Получить код
          </Button>
        </>
      )}

      {step === 'sms' && (
        <>
          <h1 className="mt-2.5 text-2xl font-extrabold leading-tight text-ink">Код из SMS</h1>
          <p className="text-sm text-ink-soft">Отправили на +7 {phone}</p>
          {/* Настоящее поле лежит поверх ячеек и прозрачно; ячейки — только
              отрисовка. Индикатор фокуса переносится на них через peer, иначе
              обводка досталась бы невидимому элементу. */}
          <div className="relative mt-2 w-fit">
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Код из SMS, 6 цифр"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="peer absolute inset-0 z-10 h-full w-full opacity-0"
            />
            <div
              aria-hidden="true"
              className="flex gap-1.5 rounded-md peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={`flex h-14 w-10 items-center justify-center rounded-md border bg-surface text-xl font-extrabold text-ink ${
                    code[i] ? 'border-primary' : 'border-border-strong'
                  }`}
                >
                  {code[i] ?? ''}
                </span>
              ))}
            </div>
          </div>
          <div className="text-xs text-ink-soft">
            {resendIn > 0 ? (
              `Отправить снова через ${formatTime(resendIn)}`
            ) : (
              <button type="button" onClick={requestCode} className="font-bold text-primary">
                Отправить код повторно
              </button>
            )}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="mt-auto sm:hidden" />
          <Button
            fullWidth
            size="lg"
            loading={submitting}
            loadingLabel="Проверяем код…"
            onClick={verify}
            disabled={code.length < 6}
          >
            Войти
          </Button>
        </>
      )}
    </main>
  );
}
