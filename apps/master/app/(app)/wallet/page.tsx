'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
};

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
}

export default function WalletPage() {
  const { payoutsEnabled } = useCommercialMode();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api('/wallet/balance').then((r) => setBalance(r.balance));
    api('/wallet/withdrawals').then(setHistory);
  }

  useEffect(() => {
    if (payoutsEnabled) load();
  }, [payoutsEnabled]);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      await api('/wallet/withdrawals', { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) });
      setAmount('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!payoutsEnabled) {
    return (
      <div className="mx-auto max-w-[480px] space-y-4 p-8">
        <h1 className="text-xl font-extrabold text-ink">Кошелёк</h1>
        <div className="rounded-lg border border-border bg-fill-soft p-5 text-center">
          <div className="text-lg font-extrabold text-primary">Расчёт напрямую с клиентом</div>
          <p className="mt-2 text-sm text-ink-soft">
            В бесплатном пилоте платформа не принимает деньги и не формирует баланс для вывода.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[480px] space-y-4 p-8">
      <h1 className="text-xl font-extrabold text-ink">Кошелёк</h1>
      <div className="rounded-lg bg-fill-soft p-4 text-center">
        <div className="text-3xl font-extrabold text-primary">{balance} ₸</div>
        <div className="text-sm text-ink-soft">доступно к выводу</div>
      </div>
      <div className="space-y-2">
        <input
          type="number"
          min="5000"
          placeholder="Сумма вывода, ₸"
          className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
          disabled={!Number(amount) || Number(amount) < 5000 || submitting}
          onClick={submit}
        >
          {submitting ? 'Отправляем…' : 'Вывести'}
        </button>
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-extrabold text-ink">История</h2>
        {history.length === 0 && <p className="text-sm text-ink-soft">Заявок пока нет</p>}
        {history.map((w) => (
          <div key={w.id} className="flex justify-between rounded-lg border border-border p-3 text-sm">
            <span className="text-ink">{w.amount} ₸</span>
            <span className="text-ink-soft">{STATUS_LABELS[w.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
