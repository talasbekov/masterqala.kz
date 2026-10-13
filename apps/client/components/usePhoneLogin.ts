'use client';
import { useEffect, useRef, useState } from 'react';
import type { AuthUser } from '@/lib/auth';
import type { LoginPendingAction } from './LoginForm';
export function usePhoneLogin({ request, onAuthenticated, onSuccess }: {
  request: (path: string, options: RequestInit) => Promise<any>;
  onAuthenticated: (token: string, user: AuthUser) => void; onSuccess: () => void;
}) {
  const [step, setStep] = useState<'phone' | 'sms'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<LoginPendingAction>(null);
  const [resendIn, setResendIn] = useState(30);
  const requestPending = useRef(false);
  useEffect(() => {
    if (step !== 'sms' || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendIn]);
  const normalizedPhone = `+7${phone.replace(/\D/g, '').slice(-10)}`;
  async function requestCode() {
    if (requestPending.current) return;
    requestPending.current = true;
    setError('');
    setPendingAction(step === 'sms' ? 'resend' : 'send');
    try {
      await request('/auth/request-code', { method: 'POST', body: JSON.stringify({ phone: normalizedPhone }) });
      setResendIn(30);
      setCode('');
      setStep('sms');
    } catch (error) { setError((error as Error).message); }
    finally { requestPending.current = false; setPendingAction(null); }
  }
  async function verify() {
    if (requestPending.current || !/^\d{6}$/.test(code)) return;
    requestPending.current = true;
    setError('');
    setPendingAction('verify');
    try {
      const response = await request('/auth/verify-code', { method: 'POST', body: JSON.stringify({ phone: normalizedPhone, code }) });
      onAuthenticated(response.accessToken, response.user);
      onSuccess();
    } catch (error) { setError((error as Error).message); }
    finally { requestPending.current = false; setPendingAction(null); }
  }
  function changeNumber() {
    if (requestPending.current) return;
    setError(''); setCode(''); setStep('phone');
  }
  return { step, phone, code, error, pendingAction, resendIn, onPhone: setPhone, onCode: setCode,
    onRequest: requestCode, onVerify: verify, onChangeNumber: changeNumber };
}
