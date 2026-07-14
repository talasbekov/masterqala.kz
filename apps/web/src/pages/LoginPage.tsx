import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function requestCode() {
    setError('');
    try {
      await api('/auth/request-code', { method: 'POST', body: JSON.stringify({ phone }) });
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function verify() {
    setError('');
    try {
      const res = await api('/auth/verify-code', { method: 'POST', body: JSON.stringify({ phone, code }) });
      login(res.accessToken, res.user);
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Вход</h1>
      {step === 'phone' ? (
        <>
          <input
            className="w-full rounded border p-3"
            placeholder="+7 707 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={requestCode}>
            Получить код
          </button>
        </>
      ) : (
        <>
          <input
            className="w-full rounded border p-3"
            placeholder="Код из SMS"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={verify}>
            Войти
          </button>
        </>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
