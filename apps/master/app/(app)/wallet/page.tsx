'use client';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input, WalletIcon } from '@masterqala/ui';
import { api } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
};

const STATUS_TONES: Record<string, 'neutral' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  PAID: 'success',
  FAILED: 'danger',
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
    api('/wallet/balance')
      .then((r) => setBalance(r.balance))
      .catch((e) => setError((e as Error).message));
    api('/wallet/withdrawals')
      .then(setHistory)
      .catch((e) => setError((e as Error).message));
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
      <div className="mx-auto w-full max-w-lg space-y-4 p-4 sm:p-6 md:p-8">
        <h1 className="text-xl font-extrabold text-ink">Кошелёк</h1>
        <Card padding="lg" className="text-center">
          <p className="text-lg font-extrabold text-primary">Расчёт напрямую с клиентом</p>
          <p className="mt-2 text-sm text-ink-soft">
            В бесплатном пилоте платформа не принимает деньги и не формирует баланс для вывода.
          </p>
        </Card>
      </div>
    );
  }

  const amountNumber = Number(amount);
  const tooSmall = amount !== '' && (!amountNumber || amountNumber < 5000);

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-extrabold text-ink">Кошелёк</h1>

      <Card className="bg-fill-soft text-center">
        <p className="text-3xl font-extrabold text-primary">{balance} ₸</p>
        <p className="text-sm text-ink-soft">доступно к выводу</p>
      </Card>

      <div className="space-y-3">
        <Input
          label="Сумма вывода, ₸"
          type="number"
          min="5000"
          inputMode="numeric"
          hint="Минимальная сумма вывода — 5000 ₸"
          error={tooSmall ? 'Минимальная сумма вывода — 5000 ₸' : undefined}
          placeholder="Например, 15000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button
          fullWidth
          loading={submitting}
          loadingLabel="Отправляем…"
          disabled={!amountNumber || amountNumber < 5000}
          onClick={submit}
        >
          Вывести
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold text-ink">История</h2>
        {history.length === 0 ? (
          <EmptyState
            icon={<WalletIcon size={32} />}
            title="Заявок пока нет"
            subtitle="Здесь появятся ваши заявки на вывод средств."
          />
        ) : (
          <ul className="space-y-2">
            {history.map((w) => (
              <Card as="li" key={w.id} padding="sm" className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-ink">{w.amount} ₸</span>
                <Badge tone={STATUS_TONES[w.status] ?? 'neutral'}>
                  {STATUS_LABELS[w.status] ?? w.status}
                </Badge>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
