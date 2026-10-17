'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, TextField, useLocale, withinDisputeWindow } from '@masterqala/ui';
import { api } from '@/lib/api';
import { masterCategoryName } from '@/lib/category-name';
import { usePlannedOrder } from '@/lib/usePlannedOrder';
import { ownPlannedBid, plannedActions, validBid, type PlannedOrderDetail } from '@/lib/plannedFeed';
import { emptyPlannedDraft, readPlannedDraft, writePlannedDraft, type PlannedDraft } from '@/lib/plannedDraft';
import { plannedCopy, plannedSlot, plannedStatus } from '@/lib/plannedCopy';
import './planned.css';

export function PlannedOrderPanel({ ownerId, id, assignedOnly = false }: { ownerId: string; id: string; assignedOnly?: boolean }) {
  const { language, formatMoney } = useLocale(), copy = plannedCopy(language);
  const controller = usePlannedOrder({ ownerId, id, assignedOnly });
  const { order, busy, loading, fresh, online, issue } = controller;
  const [cancel, setCancel] = useState(false);
  const enabled = fresh && online && !busy && !loading;
  const actions = order ? plannedActions(order, ownerId) : [];
  const bid = order ? ownPlannedBid(order, ownerId) : null;
  return <div className="mq-planned" data-planned-detail>
    <div className="mq-planned__toolbar"><Link className="mq-planned__back" href="/?tab=planned">← {copy.back}</Link>{!controller.released && <Button variant="secondary" loading={loading} disabled={busy || !online} onClick={() => void controller.refresh()}>{copy.refresh}</Button>}</div>
    <h1>{copy.detail}</h1>
    {controller.released && <p className="mq-planned__notice" role="status">{copy.released}</p>}
    {!online && <p className="mq-planned__notice" role="status">{copy.offline}</p>}
    {issue && <p className="mq-planned__error" role="alert">{copy[issue]}</p>}
    {!fresh && order && <p role="status">{copy.stale}</p>}
    {loading && !order && <p role="status">{copy.loading}</p>}
    {order && <div className="mq-planned__columns"><div className="mq-planned__main">
      <section className="mq-planned__card"><span className="mq-planned__badge">{plannedStatus(copy, order.status)}</span><h2>{order.category ? masterCategoryName(order.category, language) : copy.category}</h2><p className="mq-planned__description">{order.description}</p>
        {order.confirmDeadline && order.status === 'MASTER_SELECTED' && <p>{copy.deadline}: {new Date(order.confirmDeadline).toLocaleString(language === 'kk' ? 'kk-KZ' : language)}</p>}
        {order.status === 'DONE' && <p>{copy.waiting}</p>}
        {order.masterId === ownerId && !assignedOnly && <Link className="mq-planned__link" href={`/planned/${encodeURIComponent(id)}`}>{copy.open}</Link>}
        {order.masterId === ownerId && (order.dispute || withinDisputeWindow({ ...order, dispute: order.dispute ?? null })) && <Link className="mq-planned__back" href={`/planned/${encodeURIComponent(id)}/dispute`}>{copy.dispute}</Link>}
        <div className="mq-planned__actions">{actions.filter(action => action !== 'bids' && action !== 'cancel').map(action => <Button key={action} variant={action === 'decline' ? 'secondary' : 'primary'} disabled={!enabled} loading={busy} loadingLabel={copy.busy} onClick={() => void controller.act(action)}>{copy[action]}</Button>)}
          {actions.includes('cancel') && <Button variant="secondary" disabled={!enabled} onClick={() => setCancel(true)}>{copy.cancel}</Button>}
        </div>
        {cancel && actions.includes('cancel') && <div className="mq-planned__notice" role="group" aria-label={copy.confirmCancel}><h3>{copy.confirmCancel}</h3><p>{copy.cancelNote}</p><div className="mq-planned__actions"><Button variant="danger" disabled={!enabled} onClick={() => { setCancel(false); void controller.act('cancel'); }}>{copy.yesCancel}</Button><Button variant="secondary" onClick={() => setCancel(false)}>{copy.keep}</Button></div></div>}
      </section>
      {bid && <section className="mq-planned__card"><h2>{copy.submitted}</h2><p>{formatMoney(bid.price)} · {bid.term}</p>{bid.comment && <p className="mq-planned__description">{bid.comment}</p>}<p className="mq-planned__muted">{order.status==='PUBLISHED'?copy.submittedNote:{ru:'Сохранённые условия вашего отклика. Закрытие заказа не подтверждает перевод денег.',kk:'Ұсынысыңыздың сақталған шарттары. Тапсырыстың жабылуы ақша аударымын растамайды.',en:'The saved terms of your response. Order closure does not confirm a money transfer.'}[language]}</p></section>}
      {order.status === 'PUBLISHED' && !bid && order.masterId === null && (actions.includes('bids') ? <BidForm key={`${ownerId}:${id}`} ownerId={ownerId} order={order} disabled={!enabled} busy={busy} submit={values => controller.act('bids', values)}/> : <section className="mq-planned__card"><p>{copy.full}</p></section>)}
    </div><aside className="mq-planned__card"><h2>{copy.detail}</h2><dl>
      <div><dt>{copy.district}</dt><dd>{order.district}</dd></div><div><dt>{copy.slot}</dt><dd>{plannedSlot(order.slotStart, order.slotEnd, language)}</dd></div>
      {order.budget != null && <div><dt>{copy.budget}</dt><dd>{formatMoney(order.budget)}</dd></div>}
      {order._count && <div><dt>{copy.offers}</dt><dd>{order._count.bids}/5</dd></div>}
      {order.masterId === ownerId && <>{(['address', 'entrance', 'floor', 'apartment', 'addressComment'] as const).map(field => order[field] ? <div key={field}><dt>{copy[field === 'addressComment' ? 'instructions' : field]}</dt><dd>{order[field]}</dd></div> : null)}
        {order.client?.name && <div><dt>{copy.client}</dt><dd>{order.client.name}</dd></div>}{order.client?.phone && <div><dt>{copy.contact}</dt><dd><a href={`tel:${order.client.phone}`}>{order.client.phone}</a></dd></div>}</>}
    </dl><p className="mq-planned__muted">{order.commercialMode === 'FREE_PILOT' ? (order.masterId===ownerId?{ru:'Бесплатный пилот · FREE_PILOT. Платформа не списывает и не выплачивает деньги. Расчёты за работу — напрямую с клиентом.',kk:'Тегін пилот · FREE_PILOT. Платформа ақша алмайды және төлем жасамайды. Жұмыс ақысын клиентпен тікелей келісіңіз.',en:'Free pilot · FREE_PILOT. The platform does not charge or pay out money. Settle payment for the work directly with the client.'}[language]:copy.freeNote) : copy.paidNote}</p></aside></div>}
  </div>;
}

function BidForm({ ownerId, order, disabled, busy, submit }: {
  ownerId: string; order: PlannedOrderDetail; disabled: boolean; busy: boolean;
  submit: (values: { price: number; term: string; comment: string }) => Promise<void>;
}) {
  const { language } = useLocale(), copy = plannedCopy(language);
  const [draft, setDraft] = useState<PlannedDraft>(emptyPlannedDraft), [ready, setReady] = useState(false), [saved, setSaved] = useState(true), [invalid, setInvalid] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const paid = order.commercialMode !== 'FREE_PILOT';
  useEffect(() => { try { setDraft(readPlannedDraft(window.sessionStorage, ownerId, order.id)); } catch { setSaved(false); } setReady(true); }, [ownerId, order.id]);
  useEffect(() => {
    if (!paid) return;
    let live = true;
    api('/lead-credits/balance').then(value => { if (live && typeof value?.balance === 'number') setBalance(value.balance); }).catch(() => {});
    return () => { live = false; };
  }, [ownerId, order.id, paid]);
  function update(field: keyof PlannedDraft, value: string) {
    const next = { ...draft, [field]: value }; setDraft(next); setInvalid(false);
    try { setSaved(writePlannedDraft(window.sessionStorage, ownerId, order.id, next)); } catch { setSaved(false); }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (disabled || busy || !ready) return;
    const values = { price: Number(draft.price), term: draft.term.trim(), comment: draft.comment.trim() };
    if (!validBid(values)) { setInvalid(true); return; }
    await submit(values);
    // The form unmounts only after a GET confirms ownBid. Keep the draft through uncertain results.
  }
  return <form className="mq-planned__card" onSubmit={send}><h2>{paid ? copy.paid : copy.free}</h2>
    <div className="mq-planned__fields"><TextField label={copy.price} type="number" min="1" step="1" value={draft.price} required disabled={!ready || busy} onChange={event => update('price', event.target.value)} />
    <TextField label={copy.term} maxLength={200} value={draft.term} required disabled={!ready || busy} onChange={event => update('term', event.target.value)} /></div>
    <label className="mq-planned__textarea"><span>{copy.comment}</span><textarea rows={4} maxLength={1000} value={draft.comment} disabled={!ready || busy} onChange={event => update('comment', event.target.value)} /></label>
    <p className="mq-planned__muted">{saved ? copy.draft : copy.unsaved}</p>
    {invalid && <p className="mq-planned__error" role="alert">{copy.invalidBid}</p>}
    {paid && <><p>{copy.credits}: {balance ?? '—'}</p><Link href="/lead-credits">{copy.buyCredits}</Link></>}
    <Button type="submit" disabled={disabled || !ready || paid && (balance === null || balance < 1)} loading={busy} loadingLabel={copy.busy}>{paid ? copy.submitPaid : copy.submit}</Button>
  </form>;
}
