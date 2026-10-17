'use client';
import {formatServiceDate} from '@masterqala/ui';
import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {disputeText, disputeQuoteTotal, parseDisputeSummaries, useLocale, useOrderDispute, withinDisputeWindow, type DisputeContext, type DisputeTarget} from '@masterqala/ui';
import {useAuth} from '@/lib/auth';
import {api, apiUpload} from '@/lib/api';
import {emptyDisputeDraft, readDisputeDraft, removeDisputeDraft, saveDisputeDraft, type DisputeDraft} from './draft';
import {desktopDisputeCopy} from './copy';
import './dispute.css';

export default function DesktopDispute({kind}: {kind: DisputeTarget['kind']}) {
  const {id} = useParams<{id: string}>(), {user} = useAuth();
  return user && id ? <OwnedDispute key={`${user.id}:${kind}:${id}`} ownerId={user.id} kind={kind} id={id}/> : null;
}

function OwnedDispute({ownerId, kind, id}: DisputeTarget & {ownerId: string}) {
  const {language, formatMoney} = useLocale();
  const t = (key: Parameters<typeof disputeText>[1]) => disputeText(language, key);
  const d = desktopDisputeCopy[language];
  const scope = useMemo(() => ({ownerId, kind, id}), [ownerId, kind, id]);
  const [initial] = useState(() => readDisputeDraft(scope));
  const saved = useRef(initial.draft);
  const [pending, setPending] = useState(initial.draft.pending);
  const [storageError, setStorageError] = useState(!initial.available);
  const [hydrated, setHydrated] = useState(false);
  const lifetime = useRef<AbortController|null>(null);
  const text = useRef(d);
  useLayoutEffect(() => { text.current = d; }, [d]);
  useLayoutEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => { controller.abort(); lifetime.current = null; };
  }, []);

  const transport = useMemo(() => {
    const persist = (value: DisputeDraft) => {
      saved.current = value;
      const okay = saveDisputeDraft(scope, value);
      if (lifetime.current && !lifetime.current.signal.aborted) {setStorageError(!okay); setPending(value.pending);}
      return okay;
    };
    const active = () => {
      const current = lifetime.current;
      if (!current || current.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
      return current;
    };
    const read = async (path: string, options: RequestInit = {}) => {
      const current = active();
      const request = {...options, signal: options.signal ?? current.signal};
      if (path === `/${kind}/${encodeURIComponent(id)}/disputes` && options.method === 'POST') {
        const body = saved.current.body ?? String(options.body);
        if (!persist({...saved.current, pending: 'submit', body})) throw new Error(text.current.storage);
        return api(path, {...request, body});
      }
      if (path === `/${kind}/${encodeURIComponent(id)}` && saved.current.pending === 'submit') {
        // A lost response (including one from the previous mount) is reconciled
        // against the participant's server list before another create is enabled.
        const list = parseDisputeSummaries(await api('/disputes/mine', request));
        if (lifetime.current !== current || current.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
        const context: DisputeContext = await api(path, request);
        const matches = list.filter(item => (kind === 'orders' ? item.orderId : item.plannedOrderId) === id);
        if (matches.length && !matches.some(item => item.id === context?.dispute?.id)) throw new Error('Dispute context is not yet verified');
        return context;
      }
      return api(path, request);
    };
    const upload = async (path: string, body: FormData, options?: {signal?: AbortSignal}) => {
      const current = active();
      if (!persist({...saved.current, pending: 'upload'})) throw new Error(text.current.storage);
      return apiUpload(path, body, {signal: options?.signal ?? current.signal});
    };
    return {api: read, upload, persist};
  }, [scope, kind, id]);

  const c = useOrderDispute({ownerId, target: {kind, id}, api: transport.api, upload: transport.upload});
  useLayoutEffect(() => {
    if (!hydrated && c.contextFresh) {
      c.changeCategory(saved.current.category); c.changeReason(saved.current.reason); setHydrated(true);
    }
  }, [hydrated, c.contextFresh, c.changeCategory, c.changeReason]);
  useLayoutEffect(() => {
    if (!c.contextFresh || !c.evidenceFresh || c.busy || c.needsReconciliation || !lifetime.current) return;
    if (c.context?.dispute) {
      const okay = removeDisputeDraft(scope);
      saved.current = emptyDisputeDraft(); setPending(null); setStorageError(!okay);
    } else if (saved.current.pending) transport.persist({...saved.current, pending: null});
  }, [c.contextFresh, c.evidenceFresh, c.busy, c.needsReconciliation, c.context, scope, transport]);

  const order = c.context, dispute = order?.dispute;
  const unknown = c.needsReconciliation || (!!pending && !c.busy);
  const frozen = !!c.busy || !!pending;
  const retry = () => {transport.persist(saved.current); void c.retry();};
  const retryDisabled = c.contextLoading || c.evidenceLoading || !!c.busy || !c.online;
  const changeReason = (value: string) => {
    if (frozen) return;
    c.changeReason(value); transport.persist({...saved.current, reason: value, body: null});
  };
  const changeCategory = (value: DisputeDraft['category']) => {
    if (frozen) return;
    c.changeCategory(value); transport.persist({...saved.current, category: value, body: null});
  };
  const cancel = () => {
    if (frozen) return;
    c.cancel(); saved.current = emptyDisputeDraft(); setStorageError(!removeDisputeDraft(scope));
  };
  const date = (value?: string|null) => {
    const timestamp = value ? Date.parse(value) : NaN;
    return Number.isFinite(timestamp) ? formatServiceDate(timestamp,language,{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) : null;
  };
  const total = order ? disputeQuoteTotal(order) : null;
  const orderHref = `/${kind === 'orders' ? 'order' : 'planned'}/${encodeURIComponent(id)}`;
  const refresh = <button type="button" data-dispute-refresh className="dispute-secondary" disabled={retryDisabled} onClick={retry}>{t('retry')}</button>;

  return <section className="desktop-dispute" aria-labelledby="order-dispute-heading">
    <header className="dispute-heading"><Link href={orderHref}>← {t('back')}</Link><h1 id="order-dispute-heading">{t('title')}</h1><p>{d.intro}</p></header>
    {(c.contextLoading || c.evidenceLoading) && <p role="status" className="dispute-feedback">{t('loading')}</p>}
    {!c.online && <p role="status" className="dispute-feedback">{t('offline')}</p>}
    {(c.contextError || c.evidenceError) && <div role="alert" className="dispute-alert"><p>{t(c.contextUnavailable ? 'contextUnavailable' : c.contextError ? 'readError' : 'evidenceError')}</p>{order && <p>{t('stale')}</p>}{refresh}</div>}
    {unknown && <div role="alert" data-dispute-reconcile className="dispute-alert"><p>{t('unknown')}</p>{refresh}</div>}
    {storageError && <div role="alert" className="dispute-alert"><p>{d.storage}</p>{refresh}</div>}
    {c.writeError && <div role="alert" className="dispute-alert"><p>{t('writeError')}</p><p>{c.writeError}</p></div>}
    {order && <>
      <aside className="dispute-card dispute-context"><h2>{t('task')}</h2><dl><div><dt>{d.request}</dt><dd>{order.id}</dd></div>{order.description && <div><dt>{d.description}</dt><dd>{order.description}</dd></div>}{order.address && <div><dt>{d.address}</dt><dd>{order.address}</dd></div>}{total !== null && <div><dt>{t('total')}</dt><dd>{formatMoney(total)}</dd></div>}</dl></aside>
      {!dispute && <article className="dispute-card"><h2>{d.draft}</h2>{withinDisputeWindow(order) ? <form onSubmit={event => {event.preventDefault(); if (hydrated && !pending && !storageError) void c.submit();}}>
        <label className="dispute-field"><span>{t('reason')}</span><select value={c.category} disabled={frozen || !hydrated} onChange={event => changeCategory(event.target.value as DisputeDraft['category'])}>{(['quality','price','behavior','other'] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
        <label className="dispute-field" htmlFor="dispute-description"><span>{t('details')}</span><textarea id="dispute-description" maxLength={2000} value={c.reason} disabled={frozen || !hydrated} onChange={event => changeReason(event.target.value)}/></label>
        <p className="dispute-help">{t('max')}</p><p className="dispute-help">{d.attachmentsAfter}</p>
        {order.commercialMode === 'FREE_PILOT' && <div className="dispute-note">{d.pilot}</div>}
        <div className="dispute-actions"><button type="submit" data-dispute-submit className="dispute-primary" disabled={!hydrated || !!pending || storageError || !c.canSubmit} aria-busy={c.busy === 'submit'}>{t(c.busy === 'submit' ? 'sending' : 'send')}</button><button type="button" className="dispute-secondary" disabled={frozen} onClick={cancel}>{t('cancel')}</button></div>
        {!storageError && !!c.reason && !pending && <p className="dispute-help">{d.saved}</p>}
      </form> : <p>{t('unavailable')}</p>}</article>}
      {dispute && <>
        <article className="dispute-card"><div className="dispute-record-heading"><span className="dispute-record-icon" aria-hidden="true">✓</span><div><h2>{d.submitted}</h2><span className="dispute-status">{t(dispute.status === 'OPEN' ? 'open' : 'resolved')}</span></div></div><dl className="dispute-record-meta"><div><dt>{d.reference}</dt><dd>{dispute.id}</dd></div>{date(dispute.createdAt) && <div><dt>{d.recorded}</dt><dd>{date(dispute.createdAt)}</dd></div>}</dl><h3>{t('recordedReason')}</h3><p className="dispute-verbatim">{dispute.reason}</p>{dispute.counterStatement && <><h3>{t('savedReply')}</h3><p className="dispute-verbatim">{dispute.counterStatement}</p></>}{dispute.status === 'RESOLVED' && <div className="dispute-note"><h3>{t('decision')}</h3>{dispute.resolutionNote && <p className="dispute-verbatim">{dispute.resolutionNote}</p>}{date(dispute.resolvedAt) && <p>{d.resolved}: {date(dispute.resolvedAt)}</p>}</div>}</article>
        <article className="dispute-card"><div className="dispute-section-heading"><h2>{t('evidence')}</h2><button type="button" className="dispute-text-action" disabled={retryDisabled} onClick={retry}>{d.refresh}</button></div><p className="dispute-help">{t('uploadHelp')}</p>
          <div className="dispute-evidence-grid">{c.evidence.map((item, index) => <div key={item.id} className="dispute-evidence"><div className="dispute-file-symbol" aria-hidden="true">↗</div><div><strong>{d.file} {index + 1} · {item.mimeType === 'image/png' ? 'PNG' : item.mimeType === 'image/jpeg' ? 'JPEG' : item.mimeType}</strong><p className="dispute-file-id">{item.id}</p><p>{item.isMine ? d.you : d.participant}</p><p>{t(({PENDING_SCAN:'pending',SCANNING:'scanning',CLEAN:'clean',INFECTED:'infected',SCAN_FAILED:'scanFailed'} as const)[item.scanStatus as 'CLEAN'] ?? 'securityUnknown')}</p>{date(item.createdAt) && <p>{date(item.createdAt)}</p>}</div></div>)}</div>
          {c.evidenceFresh && !c.evidenceLoading && c.evidence.length === 0 && <p className="dispute-empty">{t('evidenceEmpty')}</p>}
          {dispute.status === 'OPEN' && <label className="dispute-upload" htmlFor="dispute-evidence"><span>{t('upload')}</span><input id="dispute-evidence" type="file" accept="image/jpeg,image/png" disabled={!!pending || storageError || !c.canUpload} onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; if (file && !pending && !storageError) void c.uploadFile(file);}}/></label>}
          {c.busy === 'upload' && <p role="status">{t('uploadBusy')}</p>}
          {c.file && c.busy !== 'upload' && <div className="dispute-note"><p>{c.file.name}</p><p>{t('duplicate')}</p><button type="button" className="dispute-secondary" disabled={!!pending || storageError || !c.canUpload} onClick={() => {if (c.file && !pending && !storageError) void c.uploadFile(c.file);}}>{t('uploadRetry')}</button></div>}
        </article>
      </>}
    </>}
    <nav className="dispute-bottom-links"><Link href={orderHref}>{t('back')}</Link><Link href="/orders">{t('orderList')}</Link></nav>
  </section>;
}
