import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input, WalletIcon } from '@masterqala/ui';
import type { BadgeTone } from '@masterqala/ui';
import { api } from '../api';
import { useCommercialMode } from '../commercial-mode';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'danger',
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
        <h1 className="text-2xl font-bold text-ink">Кошелёк</h1>
        <Card padding="lg" className="text-center">
          <div className="text-lg font-bold text-ink">Расчёт напрямую с клиентом</div>
          <p className="mt-2 text-sm text-ink-soft">
            В бесплатном пилоте платформа не принимает деньги и не формирует баланс для вывода.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold text-ink">Кошелёк</h1>
      <Card className="bg-primary-soft text-center">
        <div className="text-3xl font-bold text-primary-ink">{balance} ₸</div>
        <div className="text-sm text-primary-ink">доступно к выводу</div>
      </Card>
      <div className="space-y-2">
        <Input
          label="Сумма вывода, ₸"
          type="number"
          min={5000}
          hint="Минимальная сумма вывода — 5000 ₸"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button
          fullWidth
          loading={submitting}
          loadingLabel="Отправляем…"
          disabled={!Number(amount) || Number(amount) < 5000}
          onClick={submit}
        >
          Вывести
        </Button>
      </div>
      <div className="space-y-2">
        <h2 className="font-bold text-ink">История</h2>
        {history.length === 0 ? (
          <EmptyState
            icon={<WalletIcon size={32} />}
            title="Заявок пока нет"
            subtitle="Здесь появятся ваши запросы на вывод средств."
          />
        ) : (
          history.map((w) => (
            <Card key={w.id} padding="sm" className="flex items-center justify-between gap-3">
              <span className="font-semibold text-ink">{w.amount} ₸</span>
              <Badge tone={STATUS_TONES[w.status] ?? 'neutral'}>
                {STATUS_LABELS[w.status] ?? w.status}
              </Badge>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
