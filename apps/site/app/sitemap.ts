import type { MetadataRoute } from 'next';
import { getCategories } from '@/lib/categories';
import { getSiteUrl } from '@/lib/env';

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/become-a-master', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Категории приходят из API. Если он недоступен, карта сайта должна выйти
  // хотя бы со статикой, а не уронить сборку целиком.
  try {
    const categories = await getCategories();
    for (const category of categories) {
      entries.push({
        url: `${siteUrl}/categories/${category.slug}`,
        lastModified,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  } catch {
    // намеренно тихо: статические маршруты уже собраны
  }

  return entries;
}
