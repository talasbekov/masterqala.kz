'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api as defaultApi, ApiError } from './api';
import { getSocket as defaultGetSocket } from './socket';
import { ownPlannedBid, parsePlannedDetail, plannedActions, validBid, type BidValues, type PlannedAction, type PlannedOrderDetail } from './plannedFeed';

type Transport = (path: string, options?: RequestInit) => Promise<unknown>;
type Socket = { on: (event: string, fn: () => void) => unknown; off: (event: string, fn: () => void) => unknown };
export type PlannedIssue = '' | 'read' | 'unavailable' | 'changed' | 'uncertain' | 'failed';
/** One synchronous command lock per owner/order lifetime; every command uses a fresh GET.
 * A failed POST is reconciled by GET, and is never retried automatically. */
export function usePlannedOrder({ ownerId, id, assignedOnly, api = defaultApi, getSocket = defaultGetSocket }: {
  ownerId: string | null; id: string; assignedOnly: boolean; api?: Transport; getSocket?: () => Socket;
}) {
  const lifetime = useMemo(() => ({ ownerId, id, assignedOnly }), [ownerId, id, assignedOnly]);
  const current = useRef(lifetime), mounted = useRef(false), locked = useRef(false), ended = useRef(false);
  const latest = useRef<PlannedOrderDetail | null>(null), fresh = useRef(false);
  const blank = () => ({ lifetime, order: null as PlannedOrderDetail | null, released: false, loading: !!ownerId, busy: false, fresh: false, issue: '' as PlannedIssue, online: typeof navigator === 'undefined' || navigator.onLine });
  const [state, setState] = useState(blank);
  useLayoutEffect(() => {
    current.current = lifetime; mounted.current = true; locked.current = false; ended.current = false; latest.current = null; fresh.current = false; setState(blank());
    return () => { mounted.current = false; fresh.current = false; };
  }, [lifetime]);
  const live = useCallback(() => mounted.current && current.current === lifetime && !!ownerId, [lifetime, ownerId]);
  const read = useCallback(async () => {
    const raw = await api(`/planned-orders/${encodeURIComponent(id)}`);
    return parsePlannedDetail(raw, id, ownerId!, assignedOnly);
  }, [api, id, ownerId, assignedOnly]);
  const accept = useCallback((order: PlannedOrderDetail, issue: PlannedIssue = '') => {
    if (!live()) return;
    latest.current = order; fresh.current = true;
    setState(s => ({ ...s, order, issue, released: false, loading: false, fresh: true }));
  }, [live]);
  const fail = useCallback((error: unknown, issue: PlannedIssue) => {
    if (!live()) return;
    const unavailable = error instanceof ApiError && [403, 404].includes(error.status) || error instanceof Error && error.message === 'Planned order unavailable';
    fresh.current = false;
    if (unavailable) latest.current = null;
    setState(s => ({ ...s, order: unavailable ? null : s.order, fresh: false, loading: false, issue: unavailable ? 'unavailable' : issue }));
  }, [live]);
  const refresh = useCallback(async () => {
    if (!live() || locked.current || ended.current) return;
    locked.current = true; fresh.current = false;
    setState(s => ({ ...s, loading: true, fresh: false }));
    try { accept(await read()); } catch (error) { fail(error, 'read'); }
    finally { if (live()) { locked.current = false; setState(s => ({ ...s, loading: false })); } }
  }, [live, read, accept, fail]);
  const act = useCallback(async (action: PlannedAction, values?: BidValues) => {
    if (!live() || locked.current || !fresh.current || !latest.current || typeof navigator !== 'undefined' && !navigator.onLine) return;
    const prior = latest.current;
    if (!plannedActions(prior, ownerId!).includes(action) || action === 'bids' && (!values || !validBid(values))) return;
    locked.current = true; fresh.current = false;
    setState(s => ({ ...s, busy: true, fresh: false, issue: '' }));
    try {
      const before = await read();
      if (!live()) return;
      if (before.status !== prior.status || before.masterId !== prior.masterId || before.selectedBidId !== prior.selectedBidId || !plannedActions(before, ownerId!).includes(action)) {
        accept(before, 'changed'); return;
      }
      if (action === 'bids' && before.commercialMode !== 'FREE_PILOT') {
        const balance = await api('/lead-credits/balance') as { balance?: number };
        if (!live()) return;
        if (typeof balance?.balance !== 'number' || balance.balance < 1) { accept(before, 'failed'); return; }
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) { fail(new Error('Offline'), 'read'); return; }
      let postFailed = false;
      try { await api(`/planned-orders/${encodeURIComponent(id)}/${action}`, { method: 'POST', ...(values ? { body: JSON.stringify(values) } : {}) }); }
      catch { postFailed = true; }
      if (!live()) return;
      try {
        const raw = await api(`/planned-orders/${encodeURIComponent(id)}`);
        if (!live()) return;
        // A decline/cancellation removes this assignment. Verify the public state without
        // rendering it as an owned order or retaining the old client's contact details.
        const returned = raw as Partial<PlannedOrderDetail> | null;
        if ((action === 'decline' || action === 'cancel') && returned?.id === id && returned.lifecycleModel === 'LEGACY' && returned.status === 'PUBLISHED' && returned.masterId === null) {
          latest.current = null; fresh.current = false; ended.current = true;
          setState(s => ({ ...s, order: null, released: true, loading: false, fresh: false, issue: '' }));
          return;
        }
        const after = parsePlannedDetail(raw, id, ownerId!, assignedOnly);
        const applied = action === 'bids' ? !!ownPlannedBid(after, ownerId!) : after.status !== before.status || after.masterId !== before.masterId;
        accept(after, !applied ? (postFailed ? 'failed' : 'changed') : '');
      } catch (error) { fail(error, 'uncertain'); }
    } catch (error) { fail(error, 'read'); }
    finally { if (live()) { locked.current = false; setState(s => ({ ...s, busy: false })); } }
  }, [live, ownerId, read, accept, api, id, fail, assignedOnly]);
  useEffect(() => {
    if (!ownerId) return;
    void refresh();
    const socket = getSocket();
    const update = () => { if (live()) void refresh(); };
    const offline = () => { if (live()) { fresh.current = false; setState(s => ({ ...s, online: false, fresh: false })); } };
    const online = () => { if (live()) { setState(s => ({ ...s, online: true })); void refresh(); } };
    const events = ['planned:status', 'bid:selected', 'bid:closed', 'connect'];
    events.forEach(event => socket.on(event, update));
    window.addEventListener('online', online); window.addEventListener('offline', offline); window.addEventListener('focus', update);
    return () => { events.forEach(event => socket.off(event, update)); window.removeEventListener('online', online); window.removeEventListener('offline', offline); window.removeEventListener('focus', update); };
  }, [ownerId, getSocket, live, refresh]);
  const visible = state.lifetime === lifetime ? state : blank();
  // A handler retained from an earlier render cannot act on a replacement selection.
  const actFromRender = (action: PlannedAction, values?: BidValues) => {
    if (latest.current !== visible.order || !visible.fresh || visible.busy || visible.loading) return Promise.resolve();
    return act(action, values);
  };
  return { ...visible, refresh, act: actFromRender };
}
