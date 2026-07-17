import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiUpload } from '../api';
import { getSocket } from '../socket';
import { STATUS_LABELS, STEPPER_STEPS, WAVE_TEXTS, isTerminalStatus } from '../orderStatus';

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function OrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState('');
  const now = useNow();

  const load = useCallback(() => {
    api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onStatus = (p: any) => {
      if (p.orderId === id) load();
    };
    socket.on('order:status', onStatus);
    socket.io.on('reconnect', load); // fallback: рефетч при переподключении
    return () => {
      socket.off('order:status', onStatus);
      socket.io.off('reconnect', load);
    };
  }, [id, load]);

  async function action(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await api(`/orders/${id}/${path}`, { method: 'POST' });
      load();
    } catch (e: any) {
      setError(e.message);
      load();
    }
  }

  const [disputeReason, setDisputeReason] = useState('');
  const [counterStatement, setCounterStatement] = useState('');
  const canDispute = order && ['DONE', 'IN_PROGRESS', 'CLOSED'].includes(order.status) && !order.dispute;

  async function openDispute() {
    if (!disputeReason.trim()) return;
    try {
      await api(`/orders/${id}/disputes`, { method: 'POST', body: JSON.stringify({ reason: disputeReason }) });
      setDisputeReason('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function submitCounterStatement() {
    if (!order?.dispute || !counterStatement.trim()) return;
    try {
      await api(`/disputes/${order.dispute.id}`, { method: 'PATCH', body: JSON.stringify({ counterStatement }) });
      setCounterStatement('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function uploadEvidence(file: File) {
    if (!order?.dispute) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await apiUpload(`/disputes/${order.dispute.id}/evidence`, fd);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (error && !order) return <div className="p-6 text-red-600">{error}</div>;
  if (!order) return <div className="p-6 text-gray-500">Загрузка…</div>;

  if (order.status === 'SEARCHING') {
    return (
      <div className="mx-auto max-w-sm p-6 space-y-6 text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
        <p className="text-lg">{WAVE_TEXTS[order.wave] ?? 'Ищем мастера…'}</p>
        <p className="text-gray-500">Прошло {mmss(now - new Date(order.createdAt).getTime())}</p>
        <button className="w-full rounded border p-3" onClick={() => action('cancel', 'Отменить поиск? Это бесплатно.')}>
          Отменить
        </button>
      </div>
    );
  }

  if (order.status === 'NO_MASTERS') {
    return (
      <div className="mx-auto max-w-sm p-6 space-y-4 text-center">
        <h1 className="text-xl font-bold">Никто не откликнулся</h1>
        <p className="text-gray-600">Сервисный сбор не списан. Попробуйте ещё раз.</p>
        <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('retry-search')}>
          Повторить поиск
        </button>
        <button className="w-full rounded border p-3" onClick={() => action('cancel')}>Отменить</button>
      </div>
    );
  }

  if (isTerminalStatus(order.status)) {
    return (
      <div className="mx-auto max-w-sm p-6 space-y-3 text-center">
        <h1 className="text-xl font-bold">{STATUS_LABELS[order.status]}</h1>
        {order.cancelReason && <p className="text-gray-600">{order.cancelReason}</p>}
        {order.dispute && (
          <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 space-y-2 text-left">
            <div className="font-semibold text-orange-800">Спор {order.dispute.status === 'OPEN' ? 'открыт' : 'закрыт'}</div>
            <p className="text-sm text-gray-700">{order.dispute.reason}</p>
            {order.dispute.counterStatement && (
              <p className="text-sm text-gray-600">Пояснение: {order.dispute.counterStatement}</p>
            )}
            {order.dispute.status === 'RESOLVED' && (
              <p className="text-sm text-gray-600">
                Решение: {order.dispute.refundServiceFee ? 'сбор возвращён' : 'сбор не возвращён'}, {order.dispute.penalizeMaster ? 'мастер оштрафован' : 'без санкций'}
              </p>
            )}
            {order.dispute.status === 'OPEN' && (
              <div className="space-y-2">
                <input
                  type="file" accept="image/jpeg,image/png"
                  onChange={(e) => e.target.files?.[0] && uploadEvidence(e.target.files[0])}
                />
                <textarea
                  className="w-full rounded border p-2 text-sm"
                  placeholder="Пояснение (для второй стороны)"
                  value={counterStatement}
                  onChange={(e) => setCounterStatement(e.target.value)}
                />
                <button className="rounded border px-3 py-1 text-sm" onClick={submitCounterStatement}>Отправить пояснение</button>
              </div>
            )}
          </div>
        )}
        <button className="text-teal-700 underline" onClick={() => navigate('/')}>На главную</button>
      </div>
    );
  }

  const currentIdx = STEPPER_STEPS.findIndex((s) => s.status === order.status);
  const priceDeadline = order.priceProposedAt ? new Date(order.priceProposedAt).getTime() + 15 * 60 * 1000 : 0;

  return (
    <div className="mx-auto max-w-sm p-6 pb-32 space-y-5">
      <h1 className="text-xl font-bold">{order.category?.name}</h1>

      {order.master && (
        <div className="rounded-xl border p-4">
          <div className="font-semibold">{order.master.name ?? 'Мастер'}</div>
          <a href={`tel:${order.master.phone}`} className="text-teal-700 underline">{order.master.phone}</a>
        </div>
      )}

      <ol className="space-y-2">
        {STEPPER_STEPS.map((s, i) => (
          <li key={s.status} className={`flex items-center gap-3 ${i === currentIdx ? 'font-semibold text-teal-700' : i < currentIdx ? 'text-gray-700' : 'text-gray-400'}`}>
            <span className={`h-3 w-3 rounded-full ${i <= currentIdx ? 'bg-teal-700' : 'bg-gray-300'}`} />
            {s.label}
          </li>
        ))}
      </ol>

      {order.dispute && (
        <div className="rounded-xl border border-orange-300 bg-orange-50 p-4 space-y-2 text-left">
          <div className="font-semibold text-orange-800">Спор {order.dispute.status === 'OPEN' ? 'открыт' : 'закрыт'}</div>
          <p className="text-sm text-gray-700">{order.dispute.reason}</p>
          {order.dispute.counterStatement && (
            <p className="text-sm text-gray-600">Пояснение: {order.dispute.counterStatement}</p>
          )}
          {order.dispute.status === 'RESOLVED' && (
            <p className="text-sm text-gray-600">
              Решение: {order.dispute.refundServiceFee ? 'сбор возвращён' : 'сбор не возвращён'}, {order.dispute.penalizeMaster ? 'мастер оштрафован' : 'без санкций'}
            </p>
          )}
          {order.dispute.status === 'OPEN' && (
            <div className="space-y-2">
              <input
                type="file" accept="image/jpeg,image/png"
                onChange={(e) => e.target.files?.[0] && uploadEvidence(e.target.files[0])}
              />
              <textarea
                className="w-full rounded border p-2 text-sm"
                placeholder="Пояснение (для второй стороны)"
                value={counterStatement}
                onChange={(e) => setCounterStatement(e.target.value)}
              />
              <button className="rounded border px-3 py-1 text-sm" onClick={submitCounterStatement}>Отправить пояснение</button>
            </div>
          )}
        </div>
      )}
      {canDispute && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded border p-2 text-sm"
            placeholder="Причина спора"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
          />
          <button className="w-full rounded border border-orange-300 p-2 text-sm text-orange-700" onClick={openDispute}>
            Открыть спор
          </button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-sm space-y-2 bg-white p-4">
        {order.status === 'AWAITING_PRICE_CONFIRM' && (
          <>
            <div className="rounded-xl bg-teal-50 p-3">
              <div className="font-semibold">Стоимость работ: {order.workPrice} ₸</div>
              {order.workComment && <div className="text-sm text-gray-600">{order.workComment}</div>}
              <div className="text-sm text-gray-500">Осталось {mmss(priceDeadline - now)}</div>
            </div>
            <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('confirm-price')}>
              Подтвердить цену {order.workPrice} ₸
            </button>
            <button
              className="w-full rounded border p-3"
              onClick={() => action('reject-price', 'Отклонить цену? Заявка будет отменена, сервисный сбор удержан.')}
            >
              Отклонить
            </button>
          </>
        )}
        {order.status === 'DONE' && (
          <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={() => action('confirm-completion')}>
            Подтвердить выполнение
          </button>
        )}
        {['ACCEPTED', 'MASTER_ON_WAY'].includes(order.status) && (
          <button
            className="w-full rounded border border-red-300 p-3 text-red-600"
            onClick={() => action('cancel', 'Отменить заявку? Стоимость выезда будет удержана полностью.')}
          >
            Отменить заявку
          </button>
        )}
      </div>
    </div>
  );
}
