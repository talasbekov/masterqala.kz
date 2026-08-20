'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCommercialMode } from '@/lib/commercial-mode';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'В обработке',
  PAID: 'Выплачено',
  FAILED: 'Отклонено',
  ERROR: 'Уточняется',
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-warning-bg text-warning-ink',
  PAID: 'bg-success-bg text-success-ink',
  FAILED: 'bg-danger-bg text-danger-ink',
  ERROR: 'bg-danger-bg text-danger-ink',
};

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  payoutPhone: string;
}

function maskPhone(phone: string): string {
  // +77011112233 → +7 701 ··· 22 33
  const digits = phone.replace('+7', '');
  return `+7 ${digits.slice(0, 3)} ··· ${digits.slice(-4, -2)} ${digits.slice(-2)}`;
}

export default function WalletPage() {
  const { payoutsEnabled } = useCommercialMode();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [payoutPhone, setPayoutPhone] = useState<string | null>(null);
  const [editingPayout, setEditingPayout] = useState(false);
  const [payoutInput, setPayoutInput] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);

  function load() {
    api('/wallet/balance')
      .then((r) => setBalance(r.balance))
      .catch((e) => setError((e as Error).message));
    api('/wallet/withdrawals')
      .then(setHistory)
      .catch((e) => setError((e as Error).message));
    api('/wallet/payout-account')
      .then((r) => setPayoutPhone(r.payoutPhone))
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

  async function savePayoutAccount() {
    setSavingPayout(true);
    setPayoutError('');
    try {
      const res = await api('/wallet/payout-account', {
        method: 'PATCH',
        body: JSON.stringify({ phone: payoutInput }),
      });
      setPayoutPhone(res.payoutPhone);
      setEditingPayout(false);
      setPayoutInput('');
    } catch (e) {
      setPayoutError((e as Error).message);
    } finally {
      setSavingPayout(false);
    }
  }

  if (!payoutsEnabled) {
    return (
      <div className="mx-auto max-w-[480px] space-y-4 p-4 md:p-8">
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
    <div className="mx-auto max-w-[480px] space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-extrabold text-ink">Кошелёк</h1>
      <div className="rounded-lg bg-fill-soft p-4 text-center">
        <div className="text-3xl font-extrabold text-primary">{balance} ₸</div>
        <div className="text-sm text-ink-soft">доступно к выводу</div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-ink-soft">Куда выводим</div>
        {editingPayout ? (
          <div className="mt-2 space-y-2">
            <input
              type="tel"
              placeholder="+7 701 234 56 78"
              className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
              value={payoutInput}
              onChange={(e) => setPayoutInput(e.target.value)}
              autoFocus
            />
            {payoutError && <p className="text-sm text-danger">{payoutError}</p>}
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-pill bg-primary p-2.5 text-sm font-extrabold text-white disabled:opacity-40"
                disabled={!payoutInput || savingPayout}
                onClick={savePayoutAccount}
              >
                {savingPayout ? 'Сохраняем…' : 'Сохранить'}
              </button>
              <button
                className="rounded-pill border border-border px-4 text-sm font-bold text-ink-soft"
                onClick={() => {
                  setEditingPayout(false);
                  setPayoutError('');
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-extrabold text-ink">
              {payoutPhone ? `Kaspi · ${maskPhone(payoutPhone)}` : 'Не указано'}
            </span>
            <button className="text-sm font-bold text-primary" onClick={() => setEditingPayout(true)}>
              {payoutPhone ? 'изменить' : 'указать'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setAmount('5000')}
            className="rounded-pill border-[1.5px] border-border px-3.5 py-1.5 text-xs font-bold text-ink-soft"
          >
            5 000
          </button>
          <button
            type="button"
            onClick={() => setAmount('20000')}
            className="rounded-pill border-[1.5px] border-border px-3.5 py-1.5 text-xs font-bold text-ink-soft"
          >
            20 000
          </button>
          <button
            type="button"
            onClick={() => setAmount(String(balance))}
            disabled={balance < 5000}
            className="rounded-pill border-[1.5px] border-border px-3.5 py-1.5 text-xs font-bold text-ink-soft disabled:opacity-40"
          >
            всё · {balance} ₸
          </button>
        </div>
        <input
          type="number"
          min="5000"
          placeholder="Сумма вывода, ₸"
          className="w-full rounded-md border-[1.5px] border-border bg-surface p-3 text-sm text-ink outline-none placeholder:text-muted"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="rounded-lg bg-fill-soft p-3 text-xs leading-relaxed text-ink">
          Минимум 5 000 ₸, комиссии нет. Сумма спишется с баланса сразу; при отказе банка вернётся автоматически.
          Обычно 1–3 рабочих дня.
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          className="w-full rounded-pill bg-primary p-3.5 text-sm font-extrabold text-white disabled:opacity-40"
          disabled={!Number(amount) || Number(amount) < 5000 || !payoutPhone || submitting}
          onClick={submit}
        >
          {submitting ? 'Отправляем…' : payoutPhone ? 'Вывести' : 'Сначала укажите реквизиты'}
        </button>
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-extrabold text-ink">История</h2>
        {history.length === 0 && <p className="text-sm text-ink-soft">Заявок пока нет</p>}
        {history.map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <span className="text-ink">
              {w.amount} ₸ на {maskPhone(w.payoutPhone)}
            </span>
            <span className={`rounded-pill px-2 py-0.5 text-xs font-extrabold ${STATUS_BADGE[w.status] ?? 'bg-fill-soft text-ink-soft'}`}>
              {STATUS_LABELS[w.status] ?? w.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
