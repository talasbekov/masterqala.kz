import { getApiUrl } from './env';

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${getApiUrl()}/categories`, {
    next: { revalidate: 86400 },
  });
  if (!response.ok) {
    throw new Error(`Не удалось получить категории: HTTP ${response.status}`);
  }
  return response.json();
}
