'use client';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {OwnedOrderItem} from '../owned-orders';
type Kind = OwnedOrderItem['kind'];
interface ReadState {owner: string | null; parts: Record<Kind, OwnedOrderItem[]>; failures: Record<Kind, string>; loading: boolean; incomplete: boolean}
const empty = (owner: string | null): ReadState => ({owner, parts: {urgent: [], planned: []}, failures: {urgent: '', planned: ''}, loading: !!owner, incomplete: !!owner});
const timestamp = (item: OwnedOrderItem): number => {const value = item.createdAt ? Date.parse(item.createdAt) : NaN; return Number.isFinite(value) ? value : 0;};
function parseItems(value: unknown, kind: Kind): OwnedOrderItem[] {
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || typeof item.status !== 'string')) throw new Error('Invalid orders response');
  return value.map(item => ({...item, kind})) as OwnedOrderItem[];
}
export function useOwnedOrders({ownerId, api}: {ownerId: string | null; api: (path: string) => Promise<unknown>}) {
  const [state, setState] = useState<ReadState>(() => empty(ownerId));
  const ownership = useMemo(() => ({ownerId}), [ownerId]);
  const currentOwner = useRef(ownership);
  const generation = useRef(0);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    currentOwner.current = ownership;
    generation.current++;
    setState(empty(ownerId));
    return () => {mounted.current = false; generation.current++;};
  }, [ownership, ownerId]);
  const retry = useCallback(async () => {
    if (!ownerId || !mounted.current || currentOwner.current !== ownership) return;
    const request = ++generation.current;
    const valid = () => mounted.current && currentOwner.current === ownership && generation.current === request;
    setState(previous => ({...(previous.owner === ownerId ? previous : empty(ownerId)), loading: true, incomplete: true}));
    let remaining = 2;
    await Promise.all((['urgent', 'planned'] as const).map(async kind => {
      let items: OwnedOrderItem[] | undefined;
      let failure = '';
      try {items = parseItems(await api(kind === 'urgent' ? '/orders' : '/planned-orders/mine'), kind);}
      catch (error) {failure = error instanceof Error ? error.message : 'Orders read failed';}
      remaining--;
      const loading = remaining > 0;
      if (!valid()) return;
      setState(previous => {
        if (previous.owner !== ownerId) return previous;
        const failures = {...previous.failures, [kind]: failure};
        return {...previous, parts: items ? {...previous.parts, [kind]: items} : previous.parts, failures, loading, incomplete: loading || !!failures.urgent || !!failures.planned};
      });
    }));
  }, [ownerId, ownership, api]);
  useEffect(() => {void retry(); return () => {generation.current++;};}, [retry]);
  const visible = state.owner === ownerId ? state : empty(ownerId);
  return {items: [...visible.parts.urgent, ...visible.parts.planned].sort((a, b) => timestamp(b) - timestamp(a)), loading: visible.loading, error: [visible.failures.urgent, visible.failures.planned].filter(Boolean).join('; '), incomplete: visible.incomplete, retry};
}
