import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiUpload } from '../api';
import { getSocket } from '../socket';
import { STATUS_LABELS, STEPPER_STEPS, WAVE_TEXTS, isTerminalStatus, urgentStatusVariant } from '../orderStatus';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import StatusPill from '../components/ui/StatusPill';

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

function DisputeCard({
  dispute,
  counterStatement,
  onCounterStatementChange,
  onSubmitCounterStatement,
  onUploadEvidence,
}: {
  dispute: any;
  counterStatement: string;
  onCounterStatementChange: (v: string) => void;
  onSubmitCounterStatement: () => void;
  onUploadEvidence: (file: File) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border-2 border-accent/30 bg-accent/5 p-4 text-left">
      <div className="font-bold text-accent">Спор {dispute.status === 'OPEN' ? 'открыт' : 'закрыт'}</div>
      <p className="text-sm text-foreground">{dispute.reason}</p>
      {dispute.counterStatement && <p className="text-sm text-muted">Пояснение: {dispute.counterStatement}</p>}
      {dispute.status === 'RESOLVED' && (
        <p className="text-sm text-muted">
          Решение: {dispute.refundServiceFee ? 'сбор возвращён' : 'сбор не возвращён'}, {dispute.penalizeMaster ? 'мастер оштрафован' : 'без санкций'}
        </p>
      )}
      {dispute.status === 'OPEN' && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => e.target.files?.[0] && onUploadEvidence(e.target.files[0])}
          />
          <textarea
            className="w-full rounded-md border border-border bg-surface p-2 text-sm"
            placeholder="Пояснение (для второй стороны)"
            value={counterStatement}
            onChange={(e) => onCounterStatementChange(e.target.value)}
          />
          <button
            className="rounded-md border border-border px-3 py-1 text-sm font-semibold text-foreground"
            onClick={onSubmitCounterStatement}
          >
            Отправить пояснение
          </button>
        </div>
      )}
    </div>
  );
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

  if (error && !order) return <div className="p-6 text-destructive">{error}</div>;
  if (!order) return <div className="p-6 text-muted">Загрузка…</div>;

  if (order.status === 'SEARCHING') {
    return (
      <div className="mx-auto max-w-sm space-y-6 p-6 text-center">
        <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-lg font-semibold text-foreground">{WAVE_TEXTS[order.wave] ?? 'Ищем мастера…'}</p>
        <p className="text-muted">Прошло {mmss(now - new Date(order.createdAt).getTime())}</p>
        <Button variant="secondary" onClick={() => action('cancel', 'Отменить поиск? Это бесплатно.')}>
          Отменить
        </Button>
      </div>
    );
  }

  if (order.status === 'NO_MASTERS') {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-6 text-center">
        <h1 className="text-xl font-extrabold text-foreground">Никто не откликнулся</h1>
        <p className="text-muted">Сервисный сбор не списан. Попробуйте ещё раз.</p>
        <Button onClick={() => action('retry-search')}>Повторить поиск</Button>
        <Button variant="secondary" onClick={() => action('cancel')}>
          Отменить
        </Button>
      </div>
    );
  }

  if (isTerminalStatus(order.status)) {
    return (
      <div className="mx-auto max-w-sm space-y-3 p-6 text-center">
        <h1 className="text-xl font-extrabold text-foreground">{STATUS_LABELS[order.status]}</h1>
        {order.cancelReason && <p className="text-muted">{order.cancelReason}</p>}
        {order.dispute && (
          <DisputeCard
            dispute={order.dispute}
            counterStatement={counterStatement}
            onCounterStatementChange={setCounterStatement}
            onSubmitCounterStatement={submitCounterStatement}
            onUploadEvidence={uploadEvidence}
          />
        )}
        <button className="font-semibold text-primary underline" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    );
  }

  const currentIdx = STEPPER_STEPS.findIndex((s) => s.status === order.status);
  const priceDeadline = order.priceProposedAt ? new Date(order.priceProposedAt).getTime() + 15 * 60 * 1000 : 0;

  return (
    <div className="mx-auto max-w-sm space-y-5 p-6 pb-32">
      <h1 className="text-xl font-extrabold text-foreground">{order.category?.name}</h1>

      {order.master && (
        <Card className="flex items-center gap-3">
          <Avatar name={order.master.name} />
          <div>
            <div className="font-bold text-foreground">{order.master.name ?? 'Мастер'}</div>
            <a href={`tel:${order.master.phone}`} className="text-sm font-semibold text-primary underline">
              {order.master.phone}
            </a>
          </div>
        </Card>
      )}

      <div>
        <StatusPill variant={urgentStatusVariant(order.status)}>{STATUS_LABELS[order.status]}</StatusPill>
      </div>

      <ol className="space-y-2">
        {STEPPER_STEPS.map((s, i) => (
          <li
            key={s.status}
            className={`flex items-center gap-3 ${
              i === currentIdx ? 'font-bold text-primary' : i < currentIdx ? 'text-foreground' : 'text-muted'
            }`}
          >
            <span className={`h-3 w-3 rounded-full ${i <= currentIdx ? 'bg-primary' : 'bg-border'}`} />
            {s.label}
          </li>
        ))}
      </ol>

      {order.dispute && (
        <DisputeCard
          dispute={order.dispute}
          counterStatement={counterStatement}
          onCounterStatementChange={setCounterStatement}
          onSubmitCounterStatement={submitCounterStatement}
          onUploadEvidence={uploadEvidence}
        />
      )}
      {canDispute && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-md border border-border bg-surface p-2 text-sm"
            placeholder="Причина спора"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
          />
          <Button variant="secondary" onClick={openDispute}>
            Открыть спор
          </Button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-16 mx-auto max-w-sm space-y-2 bg-background p-4">
        {order.status === 'AWAITING_PRICE_CONFIRM' && (
          <>
            <div className="rounded-lg bg-primary/5 p-3">
              <div className="font-bold text-foreground">Стоимость работ: {order.workPrice} ₸</div>
              {order.workComment && <div className="text-sm text-muted">{order.workComment}</div>}
              <div className="text-sm text-muted">Осталось {mmss(priceDeadline - now)}</div>
            </div>
            <Button onClick={() => action('confirm-price')}>Подтвердить цену {order.workPrice} ₸</Button>
            <Button
              variant="secondary"
              onClick={() => action('reject-price', 'Отклонить цену? Заявка будет отменена, сервисный сбор удержан.')}
            >
              Отклонить
            </Button>
          </>
        )}
        {order.status === 'DONE' && <Button onClick={() => action('confirm-completion')}>Подтвердить выполнение</Button>}
        {['ACCEPTED', 'MASTER_ON_WAY'].includes(order.status) && (
          <Button
            variant="danger-outline"
            onClick={() => action('cancel', 'Отменить заявку? Стоимость выезда будет удержана полностью.')}
          >
            Отменить заявку
          </Button>
        )}
      </div>
    </div>
  );
}
