import { getApiUrl } from './env';

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${getApiUrl()}/categories`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Не удалось получить категории: HTTP ${response.status}`);
  }
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error('Invalid categories response');
  const ids = new Set<string>(), slugs = new Set<string>();
  return value.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('Invalid category');
    const {id, slug, name} = row as Record<string, unknown>;
    if (typeof id !== 'string' || !id.trim() || ids.has(id) || typeof slug !== 'string'
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)
        || typeof name !== 'string' || !name.trim()) throw new Error('Invalid category');
    ids.add(id); slugs.add(slug);
    return {id, slug, name};
  });
}
