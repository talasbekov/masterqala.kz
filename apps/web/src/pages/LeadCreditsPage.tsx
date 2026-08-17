import { useEffect, useState } from 'react';
import { Alert, Button, Card, CoinsIcon, EmptyState } from '@masterqala/ui';
import { api } from '../api';
import { useCommercialMode } from '../commercial-mode';

export default function LeadCreditsPage() {
  const { leadCreditsEnabled } = useCommercialMode();
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState('');

  function load() {
    api('/lead-credits/balance').then((r) => setBalance(r.balance));
    api('/lead-credits/packages').then(setPackages);
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPurchasing('');
    }
  }

  if (!leadCreditsEnabled) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-6">
        <h1 className="text-2xl font-bold text-ink">Lead-кредиты</h1>
        <Card padding="lg" className="text-center">
          <div className="text-lg font-bold text-ink">Отклики бесплатны</div>
          <p className="mt-2 text-sm text-ink-soft">
            В период бесплатного пилота мастеру не нужны кредиты для отклика на плановые заявки.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold text-ink">Lead-кредиты</h1>
      <Card className="bg-primary-soft text-center">
        <div className="text-3xl font-bold text-primary-ink">{balance}</div>
        <div className="text-sm text-primary-ink">кредитов на балансе</div>
      </Card>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="space-y-2">
        {packages.length === 0 ? (
          <EmptyState
            icon={<CoinsIcon size={32} />}
            title="Пакетов нет"
            subtitle="Пакеты кредитов пока недоступны."
          />
        ) : (
          packages.map((p) => (
            <Card key={p.id} className="flex items-center justify-between gap-3">
              <span className="text-base text-ink">
                {p.credits} кредит{p.credits > 1 ? 'ов' : ''}
              </span>
              <Button
                size="sm"
                loading={purchasing === p.id}
                loadingLabel="Оплата…"
                disabled={Boolean(purchasing)}
                onClick={() => purchase(p.id)}
              >
                {p.priceTenge} ₸
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
