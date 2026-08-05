'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';

interface Package {
  id: string;
  credits: number;
  priceTenge: number;
}

export default function LeadCreditsPage() {
  const { leadCreditsEnabled } = useCommercialMode();
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState<Package[]>([]);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState('');

  function load() {
    api('/lead-credits/balance')
      .then((r) => setBalance(r.balance))
      .catch((e) => setError((e as Error).message));
    api('/lead-credits/packages')
      .then(setPackages)
      .catch((e) => setError((e as Error).message));
  }

  useEffect(() => {
    if (leadCreditsEnabled) load();
  }, [leadCreditsEnabled]);

  async function purchase(id: string) {
    setPurchasing(id);
    setError('');
    try {
      const r = await api('/lead-credits/purchase', { method: 'POST', body: JSON.stringify({ package: id }) });
      setBalance(r.balance);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPurchasing('');
    }
  }

  if (!leadCreditsEnabled) {
    return (
      <div className="mx-auto max-w-[480px] space-y-4 p-8">
        <h1 className="text-xl font-extrabold text-ink">Lead-кредиты</h1>
        <div className="rounded-lg border border-border bg-fill-soft p-5 text-center">
          <div className="text-lg font-extrabold text-primary">Отклики бесплатны</div>
          <p className="mt-2 text-sm text-ink-soft">
            В период бесплатного пилота мастеру не нужны кредиты для отклика на плановые заявки.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[480px] space-y-4 p-8">
      <h1 className="text-xl font-extrabold text-ink">Lead-кредиты</h1>
      <div className="rounded-lg bg-fill-soft p-4 text-center">
        <div className="text-3xl font-extrabold text-primary">{balance}</div>
        <div className="text-sm text-ink-soft">кредитов на балансе</div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="space-y-2">
        {packages.map((p) => (
          <button
            key={p.id}
            disabled={!!purchasing}
            onClick={() => purchase(p.id)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-surface p-4 disabled:opacity-40"
          >
            <span className="text-sm text-ink">
              {p.credits} кредит{p.credits > 1 ? 'ов' : ''}
            </span>
            <span className="text-sm font-extrabold text-primary">{purchasing === p.id ? 'Оплата…' : `${p.priceTenge} ₸`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
