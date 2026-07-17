import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiUpload } from '../api';
import { getSocket } from '../socket';
import { PLANNED_STATUS_LABELS, isPlannedTerminalStatus, plannedStatusVariant } from '../orderStatus';
import { Card, Button, Avatar, StatusPill } from '@masterqala/ui';

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

export default function PlannedOrderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/planned-orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = (p: any) => {
      if (p.plannedOrderId === id) load();
    };
    socket.on('bid:new', onUpdate);
    socket.on('planned:status', onUpdate);
    return () => {
      socket.off('bid:new', onUpdate);
      socket.off('planned:status', onUpdate);
    };
  }, [id, load]);

  async function selectBid(bidId: string) {
    try {
      await api(`/planned-orders/${id}/select`, { method: 'POST', body: JSON.stringify({ bidId }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function action(path: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await api(`/planned-orders/${id}/${path}`, { method: 'POST' });
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
      await api(`/planned-orders/${id}/disputes`, { method: 'POST', body: JSON.stringify({ reason: disputeReason }) });
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

  return (
    <div className="mx-auto max-w-sm space-y-4 p-6 pb-32">
      <h1 className="text-xl font-extrabold text-foreground">{order.category?.name}</h1>
      <StatusPill variant={plannedStatusVariant(order.status)}>{PLANNED_STATUS_LABELS[order.status]}</StatusPill>
      <div className="text-sm text-muted">{new Date(order.scheduledAt).toLocaleString('ru-RU')}</div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {order.status === 'PUBLISHED' && (
        <div className="space-y-2">
          <h2 className="font-bold text-foreground">Ставки ({order.bids.length}/5)</h2>
          {order.bids.length === 0 && <p className="text-muted">Пока никто не откликнулся</p>}
          {order.bids.map((b: any) => (
            <Card key={b.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">{b.price} ₸</span>
                <span className="text-sm text-muted">{b.term}</span>
              </div>
              {b.comment && <div className="text-sm text-muted">{b.comment}</div>}
              <Button onClick={() => selectBid(b.id)}>Выбрать</Button>
            </Card>
          ))}
        </div>
      )}

      {['MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CLOSED'].includes(order.status) && order.master && (
        <Card className="flex items-center gap-3">
          <Avatar name={order.master.name} />
          <div>
            <div className="font-bold text-foreground">{order.master.name ?? 'Мастер'}</div>
            {order.master.phone ? (
              <a href={`tel:${order.master.phone}`} className="text-sm font-semibold text-primary underline">
                {order.master.phone}
              </a>
            ) : (
              <div className="text-sm text-muted">Ждём подтверждения…</div>
            )}
          </div>
        </Card>
      )}

      {isPlannedTerminalStatus(order.status) && (
        <button className="font-semibold text-primary underline" onClick={() => navigate('/')}>
          На главную
        </button>
      )}

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
        {order.status === 'DONE' && <Button onClick={() => action('confirm-completion')}>Подтвердить выполнение</Button>}
        {['CREATED', 'PUBLISHED', 'MASTER_SELECTED', 'CONFIRMED', 'IN_PROGRESS'].includes(order.status) && (
          <Button variant="danger-outline" onClick={() => action('cancel', 'Отменить заявку?')}>
            Отменить
          </Button>
        )}
      </div>
    </div>
  );
}
