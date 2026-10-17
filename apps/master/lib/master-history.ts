'use client';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {api} from './api';
import {useAuth} from './auth';

export type HistoryFilter = 'all' | 'active' | 'history';
export interface MasterHistoryItem { id: string; kind: 'urgent' | 'planned'; status: string; district: string; createdAt: string; category: {slug: string; name: string} }
interface HistoryPage {items: MasterHistoryItem[]; nextCursor: string | null}
export function parseMasterHistory(value: unknown): HistoryPage {
  if (!value || typeof value !== 'object') throw new Error('Invalid history');
  const page = value as HistoryPage;
  if (!Array.isArray(page.items) || page.items.length > 50 || !(page.nextCursor === null || typeof page.nextCursor === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(page.nextCursor))) throw new Error('Invalid history');
  const keys = new Set<string>();
  for (const item of page.items) {
    if (!item || !['urgent','planned'].includes(item.kind) || typeof item.id !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(item.id) || typeof item.status !== 'string' || typeof item.district !== 'string' || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) || !item.category || typeof item.category.name !== 'string' || typeof item.category.slug !== 'string') throw new Error('Invalid history item');
    const key = `${item.kind}:${item.id}`;
    if (keys.has(key)) throw new Error('Duplicate history item');
    keys.add(key);
  }
  return page;
}

export function useMasterHistory(filter: HistoryFilter) {
  const {user} = useAuth();
  // Identity object changes on login, even A -> B -> A or a fresh login as A.
  const scope = useMemo(() => ({owner: user?.id, alive: true, request: null as AbortController | null}), [user, filter]);
  const current = useRef(scope); current.current = scope;
  const [state, setState] = useState<{scope: typeof scope; items: MasterHistoryItem[]; nextCursor: string | null; loading: boolean; error: boolean}>(() => ({scope, items: [], nextCursor: null, loading: true, error: false}));
  const visible = state.scope === scope ? state : {scope, items: [], nextCursor: null, loading: !!user, error: false};
  const load = useCallback(async (cursor: string | null = null) => {
    if (!scope.owner || !scope.alive || current.current !== scope || scope.request) return;
    const request = new AbortController(); scope.request = request;
    setState(previous => ({scope, items: cursor && previous.scope === scope ? previous.items : [], nextCursor: cursor, loading: true, error: false}));
    try {
      const params = new URLSearchParams({filter, limit: '20'});
      if (cursor) params.set('cursor', cursor);
      const page = parseMasterHistory(await api(`/master/orders?${params}`, {signal: request.signal, cache: 'no-store'}));
      if (request.signal.aborted || !scope.alive || current.current !== scope) return;
      if (page.nextCursor && (page.nextCursor === cursor || page.items.length === 0)) throw new Error('Non-advancing cursor');
      setState(previous => {
        const existing = cursor && previous.scope === scope ? previous.items : [];
        const known = new Set(existing.map(item => `${item.kind}:${item.id}`));
        return {scope, items: [...existing, ...page.items.filter(item => !known.has(`${item.kind}:${item.id}`))], nextCursor: page.nextCursor, loading: false, error: false};
      });
    } catch {
      if (!request.signal.aborted && scope.alive && current.current === scope) setState(previous => ({...previous, scope, loading: false, error: true}));
    } finally { if (scope.request === request) scope.request = null; }
  }, [scope, filter]);
  useEffect(() => {
    scope.alive = true; void load();
    return () => {scope.alive = false; scope.request?.abort(); scope.request = null;};
  }, [scope, load]);
  return {...visible, loadMore: () => load(visible.nextCursor), retry: () => load(visible.nextCursor), authenticated: !!user};
}
