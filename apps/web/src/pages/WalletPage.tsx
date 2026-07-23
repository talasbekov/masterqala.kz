import { useEffect, useState } from 'react';
import { api } from '../api';
import { useCommercialMode } from '../commercial-mode';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
};

export default function WalletPage() {
  const { payoutsEnabled } = useCommercialMode();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!payoutsEnabled) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-6">
        <h1 className="text-2xl font-bold">Кошелёк</h1>
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 text-center">
          <div className="text-lg font-bold text-teal-800">Расчёт напрямую с клиентом</div>
          <p className="mt-2 text-sm text-gray-600">
            В бесплатном пилоте платформа не принимает деньги и не формирует баланс для вывода.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Кошелёк</h1>
      <div className="rounded-xl bg-teal-50 p-4 text-center">
        <div className="text-3xl font-bold text-teal-700">{balance} ₸</div>
        <div className="text-sm text-gray-600">доступно к выводу</div>
      </div>
      <div className="space-y-2">
        <input
          type="number" min="5000" placeholder="Сумма вывода, ₸"
          className="w-full rounded border p-3" value={amount} onChange={(e) => setAmount(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="w-full rounded bg-teal-700 p-3 text-white disabled:opacity-40"
          disabled={!Number(amount) || Number(amount) < 5000 || submitting}
          onClick={submit}
        >
          {submitting ? 'Отправляем…' : 'Вывести'}
        </button>
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">История</h2>
        {history.length === 0 && <p className="text-gray-500">Заявок пока нет</p>}
        {history.map((w) => (
          <div key={w.id} className="flex justify-between rounded-xl border p-3">
            <span>{w.amount} ₸</span>
            <span className="text-sm text-gray-500">{STATUS_LABELS[w.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
