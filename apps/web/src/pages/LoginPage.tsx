import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

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
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 bg-background p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">MasterQala</h1>
        <p className="mt-1 text-sm text-muted">Мастер на дом за пару минут</p>
      </div>
      <Card className="space-y-4">
        {step === 'phone' ? (
          <>
            <input
              className="w-full rounded-md border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
              placeholder="+7 707 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button onClick={requestCode}>Получить код</Button>
          </>
        ) : (
          <>
            <input
              className="w-full rounded-md border border-border bg-surface p-3 text-[15px] outline-none focus:border-primary"
              placeholder="Код из SMS"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button onClick={verify}>Войти</Button>
          </>
        )}
        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
      </Card>
    </div>
  );
}
