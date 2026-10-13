'use client';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
export interface BrowseCategory {id: string; slug: string; name: string}
interface BrowserState {categories: BrowseCategory[]; loading: boolean; error: string}
const initial = (): BrowserState => ({categories: [], loading: true, error: ''});
function parseCategories(value: unknown): BrowseCategory[] {
  if (!Array.isArray(value)) throw new Error('Invalid categories response');
  const ids = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== 'object' || ['id', 'slug', 'name'].some(key => typeof row[key] !== 'string' || !row[key].trim()) || ids.has(row.id)) throw new Error('Invalid category response');
    ids.add(row.id);
  }
  return value;
}
/** Public categories are isolated by API/read lifetime, never an owner cache. */
export function useCategoryBrowser({api}: {api: (path: string) => Promise<unknown>}) {
  const lifetime = useMemo(() => ({}), [api]);
  const current = useRef(lifetime), mounted = useRef(false), generation = useRef(0), pending = useRef(false);
  const [stored, setStored] = useState(() => ({lifetime, ...initial()}));
  useLayoutEffect(() => {
    current.current = lifetime; mounted.current = true; pending.current = false; generation.current++;
    setStored({lifetime, ...initial()});
    return () => {mounted.current = false; pending.current = false; generation.current++;};
  }, [lifetime]);
  const retry = useCallback(async () => {
    if (!mounted.current || current.current !== lifetime || pending.current) return;
    pending.current = true;
    const request = ++generation.current;
    const valid = () => mounted.current && current.current === lifetime && generation.current === request;
    setStored(previous => ({...(previous.lifetime === lifetime ? previous : {lifetime, ...initial()}), loading: true}));
    try {
      const categories = parseCategories(await api('/categories'));
      if (valid()) setStored({lifetime, categories, loading: false, error: ''});
    } catch (cause) {
      if (valid()) setStored(previous => ({...previous, loading: false, error: cause instanceof Error ? cause.message : 'Categories unavailable'}));
    } finally {
      if (valid()) pending.current = false;
    }
  }, [api, lifetime]);
  useEffect(() => {void retry();}, [retry]);
  const state = stored.lifetime === lifetime ? stored : initial();
  return {categories: state.categories, loading: state.loading, error: state.error, retry};
}
