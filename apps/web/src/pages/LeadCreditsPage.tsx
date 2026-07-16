import { useEffect, useState } from 'react';
import { api } from '../api';

export default function LeadCreditsPage() {
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState('');

  function load() {
    api('/lead-credits/balance').then((r) => setBalance(r.balance));
    api('/lead-credits/packages').then(setPackages);
  }

  useEffect(load, []);

  async function purchase(id: string) {
    setPurchasing(id);
    setError('');
    try {
      const r = await api('/lead-credits/purchase', { method: 'POST', body: JSON.stringify({ package: id }) });
      setBalance(r.balance);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPurchasing('');
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Lead-кредиты</h1>
      <div className="rounded-xl bg-teal-50 p-4 text-center">
        <div className="text-3xl font-bold text-teal-700">{balance}</div>
        <div className="text-sm text-gray-600">кредитов на балансе</div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        {packages.map((p) => (
          <button
            key={p.id}
            disabled={!!purchasing}
            onClick={() => purchase(p.id)}
            className="flex w-full items-center justify-between rounded-xl border p-4 disabled:opacity-40"
          >
            <span>{p.credits} кредит{p.credits > 1 ? 'ов' : ''}</span>
            <span className="font-semibold text-teal-700">{purchasing === p.id ? 'Оплата…' : `${p.priceTenge} ₸`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
