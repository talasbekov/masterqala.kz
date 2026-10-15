'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LoginPendingAction } from './LoginForm';
import { useLocale } from './Locale';
import { phoneLoginText } from './phone-login-copy';
export function usePhoneLogin<User>({ request, onAuthenticated, onSuccess, flowKey = 'login' }: {
  flowKey?: string; request: (path: string, options: RequestInit) => Promise<any>;
  onAuthenticated: (token: string, user: User) => void; onSuccess: () => void;
}) {
  const [step, setStep] = useState<'phone' | 'sms'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const { language } = useLocale();
  const [error, setError] = useState<unknown>('');
  const networkFailure = error instanceof TypeError && /^(Failed to fetch|NetworkError when attempting to fetch resource\.|Load failed|fetch failed)$/i.test(error.message);
  const errorMessage = networkFailure ? phoneLoginText(language, 'auth.networkError')
    : error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const [pendingAction, setPendingAction] = useState<LoginPendingAction>(null);
  const [resendIn, setResendIn] = useState(30);
  const requestPending = useRef(false);
  const mounted = useRef(false);
  const flowLifetime = useMemo(() => ({ flowKey }), [flowKey]);
  const currentFlowLifetime = useRef(flowLifetime);
  const requestGeneration = useRef(0);
  const phoneRevision = useRef(0);
  const currentPhone = useRef(phone);
  const renderedPhoneRevision = phoneRevision.current;
  const codeRevision = useRef(0);
  const currentCode = useRef(code);
  const renderedCodeRevision = codeRevision.current;
  useLayoutEffect(() => {
    mounted.current = true;
    currentFlowLifetime.current = flowLifetime;
    requestGeneration.current++; requestPending.current = false; setPendingAction(null);
    return () => { mounted.current = false; requestGeneration.current++; requestPending.current = false; };
  }, [flowLifetime]);
  const currentHandler = () => mounted.current && currentFlowLifetime.current === flowLifetime && phoneRevision.current === renderedPhoneRevision;
  function updateCode(value: string) {
    if (currentCode.current !== value) codeRevision.current++;
    currentCode.current = value; setCode(value);
  }
  function validRequest(generation: number) { return currentHandler() && requestGeneration.current === generation; }

  useEffect(() => {
    if (step !== 'sms' || resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, resendIn]);
  const normalizedPhone = `+7${phone.replace(/\D/g, '').slice(-10)}`;
  async function requestCode() {
    if (!currentHandler() || requestPending.current) return;
    requestPending.current = true;
    setError('');
    setPendingAction(step === 'sms' ? 'resend' : 'send');
    const generation = ++requestGeneration.current;
    try {
      await request('/auth/request-code', { method: 'POST', body: JSON.stringify({ phone: normalizedPhone }) });
      if (!validRequest(generation)) return;
      setResendIn(30);
      updateCode('');
      setStep('sms');
    } catch (error) { if (validRequest(generation)) setError(error); }
    finally { if (validRequest(generation)) { requestPending.current = false; setPendingAction(null); } }
  }
  async function verify() {
    if (!currentHandler() || codeRevision.current !== renderedCodeRevision || requestPending.current || !/^\d{6}$/.test(code)) return;
    requestPending.current = true;
    setError('');
    setPendingAction('verify');
    const generation = ++requestGeneration.current;
    try {
      const response = await request('/auth/verify-code', { method: 'POST', body: JSON.stringify({ phone: normalizedPhone, code }) });
      if (!validRequest(generation)) return;
      onAuthenticated(response.accessToken, response.user);
      if (validRequest(generation)) onSuccess();
    } catch (error) { if (validRequest(generation)) setError(error); }
    finally { if (validRequest(generation)) { requestPending.current = false; setPendingAction(null); } }
  }
  function changeNumber() {
    if (!currentHandler() || requestPending.current) return;
    requestGeneration.current++;
    setError(''); updateCode(''); setStep('phone');
  }
  function changePhone(value: string) {
    if (!mounted.current || currentFlowLifetime.current !== flowLifetime) return;
    if (value !== currentPhone.current) {
      phoneRevision.current++;
      requestGeneration.current++;
      requestPending.current = false;
      setPendingAction(null); updateCode(''); setError(''); setStep('phone');
    }
    currentPhone.current = value;
    setPhone(value);
  }
  function changeCode(value: string) { if (currentHandler() && !requestPending.current) updateCode(value); }
  return { step, phone, code, error: errorMessage, pendingAction, resendIn, onPhone: changePhone, onCode: changeCode,
    onRequest: requestCode, onVerify: verify, onChangeNumber: changeNumber };
}
