'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, CoinsIcon, EmptyState } from '@masterqala/ui';
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
      <div className="mx-auto w-full max-w-lg space-y-4 p-4 sm:p-6 md:p-8">
        <h1 className="text-xl font-extrabold text-ink">Lead-кредиты</h1>
        <Card padding="lg" className="text-center">
          <p className="text-lg font-extrabold text-primary">Отклики бесплатны</p>
          <p className="mt-2 text-sm text-ink-soft">
            В период бесплатного пилота мастеру не нужны кредиты для отклика на плановые заявки.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-extrabold text-ink">Lead-кредиты</h1>

      <Card className="bg-fill-soft text-center">
        <p className="text-3xl font-extrabold text-primary">{balance}</p>
        <p className="text-sm text-ink-soft">кредитов на балансе</p>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {packages.length === 0 ? (
        <EmptyState
          icon={<CoinsIcon size={32} />}
          title="Пакеты недоступны"
          subtitle="Сейчас нет пакетов для покупки. Попробуйте позже."
        />
      ) : (
        <ul className="space-y-2">
          {packages.map((p) => (
            <Card as="li" key={p.id} padding="sm" className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink">
                {p.credits} кредит{p.credits > 1 ? 'ов' : ''}
              </span>
              <Button
                size="sm"
                variant="secondary"
                loading={purchasing === p.id}
                loadingLabel="Оплата…"
                disabled={!!purchasing}
                onClick={() => purchase(p.id)}
                aria-label={`Купить ${p.credits} кредитов за ${p.priceTenge} ₸`}
              >
                Купить за {p.priceTenge} ₸
              </Button>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
